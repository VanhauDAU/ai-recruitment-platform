"""Candidates following a company: endpoint contract and counter invariants."""

import json
import random
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.core.cache import cache
from django.db import close_old_connections
from django.db.models import Count
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import User

from ..models import Company, CompanyFollow, Industry
from ..services import follow_company, unfollow_company
from .company_page_helpers import (
    add_recruiter,
    hold_company,
    make_candidate,
    make_company,
    make_employer,
    publish_job,
)
from .test_company_page import LIST_ITEM_KEYS

NOT_FOLLOWING = {'following': False, 'notify_new_jobs': False}


def follower_counts_match_rows():
    """``follower_count`` equals COUNT(*) of follow rows for every company."""
    stored = dict(Company.objects.values_list('pk', 'follower_count'))
    rows = dict(
        CompanyFollow.objects.values('company_id')
        .annotate(total=Count('id'))
        .values_list('company_id', 'total')
    )
    return all(count == rows.get(company_id, 0) for company_id, count in stored.items())


class CompanyFollowTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.creator = make_employer('follow-creator@example.com')
        self.company = make_company(self.creator, name='Công ty Được Theo Dõi')
        self.candidate = make_candidate('follow-candidate@example.com')
        self.client.force_authenticate(self.candidate)

    def follow_url(self, company=None):
        return reverse('company-follow', args=[(company or self.company).public_id])

    def follow(self, company=None, **body):
        return self.client.put(self.follow_url(company), body, format='json')

    def unfollow(self, company=None):
        return self.client.delete(self.follow_url(company))

    def follower_count(self, company=None):
        return Company.objects.get(pk=(company or self.company).pk).follower_count


class CompanyFollowApiTests(CompanyFollowTestCase):
    def test_role_matrix(self):
        admin = User.objects.create_superuser(
            email='follow-admin@example.com',
            password='Password@123',
        )
        list_url = reverse('candidate-followed-companies')
        cases = [(None, 401), (self.creator, 403), (admin, 403), (self.candidate, 200)]
        for user, expected in cases:
            with self.subTest(user=getattr(user, 'email', 'anonymous')):
                self.client.force_authenticate(user)

                self.assertEqual(self.client.get(self.follow_url()).status_code, expected)
                self.assertEqual(self.follow().status_code, expected)
                self.assertEqual(self.unfollow().status_code, expected)
                self.assertEqual(self.client.get(list_url).status_code, expected)

        self.assertFalse(CompanyFollow.objects.exists())

    def test_first_follow_turns_new_job_emails_on(self):
        before = self.client.get(self.follow_url())

        followed = self.follow()

        self.assertEqual(before.status_code, 200, before.data)
        self.assertEqual(before.data, {**NOT_FOLLOWING, 'follower_count': 0})
        self.assertEqual(followed.status_code, 200, followed.data)
        self.assertEqual(
            followed.data,
            {'following': True, 'notify_new_jobs': True, 'follower_count': 1},
        )
        self.assertEqual(self.client.get(self.follow_url()).data, followed.data)
        follow = CompanyFollow.objects.get()
        self.assertEqual((follow.candidate, follow.company), (self.candidate, self.company))

    def test_put_is_idempotent_and_keeps_the_stored_email_choice(self):
        opted_out = self.follow(notify_new_jobs=False)
        repeated = self.follow()
        explicit_null = self.follow(notify_new_jobs=None)
        form_without_key = self.client.put(self.follow_url(), {}, format='multipart')
        opted_in = self.follow(notify_new_jobs=True)

        self.assertEqual(
            opted_out.data,
            {'following': True, 'notify_new_jobs': False, 'follower_count': 1},
        )
        for response in (repeated, explicit_null, form_without_key):
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data, opted_out.data)
        self.assertEqual(
            opted_in.data,
            {'following': True, 'notify_new_jobs': True, 'follower_count': 1},
        )
        self.assertEqual(CompanyFollow.objects.count(), 1)

    def test_invalid_email_choice_is_rejected(self):
        response = self.follow(notify_new_jobs='thỉnh thoảng')

        self.assertEqual(response.status_code, 400)
        self.assertIn('notify_new_jobs', response.data)
        self.assertFalse(CompanyFollow.objects.exists())

    def test_delete_is_idempotent(self):
        self.follow()

        first = self.unfollow()
        second = self.unfollow()

        for response in (first, second):
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data, {**NOT_FOLLOWING, 'follower_count': 0})
        self.assertFalse(CompanyFollow.objects.exists())

    def test_follower_count_is_the_total_across_candidates(self):
        others = [make_candidate(f'follow-other-{index}@example.com') for index in range(2)]
        for other in others:
            follow_company(company=self.company, candidate=other)

        followed = self.follow()
        self.client.force_authenticate(others[0])
        other_left = self.unfollow()
        self.client.force_authenticate(self.candidate)

        self.assertEqual(followed.data['follower_count'], 3)
        self.assertEqual(other_left.data, {**NOT_FOLLOWING, 'follower_count': 2})
        self.assertEqual(
            self.client.get(self.follow_url()).data,
            {'following': True, 'notify_new_jobs': True, 'follower_count': 2},
        )

    def test_unknown_and_held_company_answer_the_same_404(self):
        held = make_company(self.creator, name='Công ty Bị Ẩn')
        follow_company(company=held, candidate=self.candidate)
        hold_company(held)
        urls = [reverse('company-follow', args=['co_unknown']), self.follow_url(held)]

        for url in urls:
            for method in ('get', 'put', 'delete'):
                with self.subTest(url=url, method=method):
                    response = getattr(self.client, method)(url, {}, format='json')
                    self.assertEqual(response.status_code, 404)
                    self.assertEqual(response.data, {'detail': 'Không tìm thấy công ty.'})

        # The hold hides the page; it does not rewrite who follows it.
        self.assertEqual(CompanyFollow.objects.filter(company=held).count(), 1)
        self.assertEqual(self.follower_count(held), 1)

    def test_counter_writes_never_move_company_updated_at(self):
        updated_at = Company.objects.get(pk=self.company.pk).updated_at

        self.follow()
        after_follow = Company.objects.get(pk=self.company.pk)
        self.unfollow()
        after_unfollow = Company.objects.get(pk=self.company.pk)

        self.assertEqual((after_follow.follower_count, after_follow.updated_at), (1, updated_at))
        self.assertEqual(
            (after_unfollow.follower_count, after_unfollow.updated_at),
            (0, updated_at),
        )

    def test_mutations_are_throttled_per_account_and_reads_are_not(self):
        other = make_candidate('follow-other-throttle@example.com')
        try:
            with patch.dict(ScopedRateThrottle.THROTTLE_RATES, {'company_follow': '2/hour'}):
                mutations = [self.follow(), self.unfollow(), self.follow()]
                read = self.client.get(self.follow_url())
                self.client.force_authenticate(other)
                other_account = self.follow()
        finally:
            cache.clear()

        self.assertEqual([response.status_code for response in mutations], [200, 200, 429])
        self.assertEqual(read.status_code, 200)
        self.assertEqual(other_account.status_code, 200)

    def test_public_page_shows_only_the_follower_total(self):
        self.candidate.full_name = 'Nguyễn Người Theo Dõi'
        self.candidate.save(update_fields=['full_name'])
        owner = add_recruiter(self.company, approved=False)
        self.follow()
        self.client.force_authenticate(None)

        detail = self.client.get(reverse('public-company-detail', args=[self.company.slug]))
        directory = self.client.get(reverse('public-company-list'), {'q': 'theo doi'})
        self.client.force_authenticate(owner)
        employer_company = self.client.get(reverse('employer-company'))

        self.assertEqual(detail.data['stats']['follower_count'], 1)
        self.assertEqual(len(directory.data['results']), 1)
        self.assertEqual(employer_company.status_code, 200, employer_company.data)
        for response in (detail, directory, employer_company):
            payload = json.dumps(response.data, ensure_ascii=False, default=str)
            for identity in (
                self.candidate.email,
                self.candidate.public_id,
                self.candidate.full_name,
            ):
                with self.subTest(identity=identity):
                    self.assertNotIn(identity, payload)


class FollowerCountInvariantTests(CompanyFollowTestCase):
    def test_hard_deleting_a_candidate_releases_their_follows(self):
        second_company = make_company(self.creator, name='Công ty Thứ Hai')
        staying = make_candidate('follow-staying@example.com')
        for company in (self.company, second_company):
            follow_company(company=company, candidate=self.candidate)
        follow_company(company=self.company, candidate=staying)
        updated_at = Company.objects.get(pk=self.company.pk).updated_at

        self.candidate.delete()

        self.assertEqual(self.follower_count(), 1)
        self.assertEqual(self.follower_count(second_company), 0)
        self.assertEqual(
            list(CompanyFollow.objects.values_list('candidate', 'company')),
            [(staying.pk, self.company.pk)],
        )
        self.assertEqual(Company.objects.get(pk=self.company.pk).updated_at, updated_at)

    def test_deleting_an_already_removed_follow_does_not_decrement_again(self):
        follow_company(company=self.company, candidate=self.candidate)
        follow_company(
            company=self.company,
            candidate=make_candidate('follow-staying@example.com'),
        )
        # What a second transaction holds after it collected the same row.
        stale = CompanyFollow.objects.get(candidate=self.candidate)

        unfollow_company(company=self.company, candidate=self.candidate)
        stale.delete()

        self.assertEqual(self.follower_count(), 1)
        self.assertTrue(follower_counts_match_rows())

    def test_random_sequence_keeps_counter_equal_to_row_count(self):
        chooser = random.Random(20261114)
        companies = [self.company] + [
            make_company(self.creator, name=f'Công ty ngẫu nhiên {index}') for index in range(3)
        ]
        candidates = [make_candidate(f'follow-random-{index}@example.com') for index in range(8)]

        for step in range(160):
            action = chooser.choice(['follow', 'follow', 'unfollow', 'unfollow', 'delete'])
            if action == 'delete' and len(candidates) > 3:
                candidates.pop(chooser.randrange(len(candidates))).delete()
            else:
                self.client.force_authenticate(chooser.choice(candidates))
                send = self.unfollow if action == 'unfollow' else self.follow
                response = send(chooser.choice(companies))
                self.assertEqual(response.status_code, 200, response.data)
            self.assertTrue(follower_counts_match_rows(), f'counter drifted at step {step}')

        self.assertTrue(CompanyFollow.objects.exists())
        self.assertLess(len(candidates), 8)


class FollowedCompanyListTests(CompanyFollowTestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse('candidate-followed-companies')

    def _follow_at(self, company, *, days_ago, candidate=None, notify_new_jobs=None):
        candidate = candidate or self.candidate
        follow_company(company=company, candidate=candidate, notify_new_jobs=notify_new_jobs)
        CompanyFollow.objects.filter(company=company, candidate=candidate).update(
            created_at=timezone.now() - timedelta(days=days_ago)
        )

    def test_list_contract_newest_follow_first(self):
        industry = Industry.objects.create(name='Công nghệ thông tin')
        oldest = make_company(
            self.creator,
            name='Công ty TNHH Phần mềm Alpha',
            trade_name='Alpha Tech',
            industry=industry,
            tax_code='0101234567',
            email='private-contact@alpha.example',
            address='17 Duy Tân, Cầu Giấy, Hà Nội',
            description='<p>Giới thiệu <strong>Alpha</strong>.</p>',
        )
        publish_job(oldest, add_recruiter(oldest))
        newest = make_company(self.creator, name='Công ty Mới Theo Dõi')
        held = make_company(self.creator, name='Công ty Bị Ẩn')
        someone_elses = make_company(self.creator, name='Công ty Của Người Khác')
        self._follow_at(oldest, days_ago=3, notify_new_jobs=False)
        self._follow_at(held, days_ago=2)
        self._follow_at(newest, days_ago=1)
        self._follow_at(
            someone_elses,
            days_ago=0,
            candidate=make_candidate('follow-list-other@example.com'),
        )
        hold_company(held)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertSetEqual(set(response.data), {'count', 'next', 'previous', 'results'})
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(
            [item['public_id'] for item in response.data['results']],
            [newest.public_id, oldest.public_id],
        )
        for item in response.data['results']:
            self.assertSetEqual(set(item), LIST_ITEM_KEYS | {'followed_at', 'notify_new_jobs'})
        newest_item, oldest_item = response.data['results']
        self.assertIs(newest_item['notify_new_jobs'], True)
        self.assertEqual(newest_item['active_public_job_count'], 0)
        self.assertIs(oldest_item['notify_new_jobs'], False)
        self.assertEqual(oldest_item['active_public_job_count'], 1)
        self.assertEqual(oldest_item['trade_name'], 'Alpha Tech')
        self.assertEqual(oldest_item['headquarters'], '17 Duy Tân, Cầu Giấy, Hà Nội')
        self.assertEqual(oldest_item['description_excerpt'], 'Giới thiệu Alpha.')
        self.assertEqual(oldest_item['industries_detail'][0]['name'], 'Công nghệ thông tin')
        self.assertEqual(
            parse_datetime(oldest_item['followed_at']),
            CompanyFollow.objects.get(company=oldest).created_at,
        )
        payload = json.dumps(response.data, ensure_ascii=False)
        for private_value in ('0101234567', 'private-contact@alpha.example'):
            self.assertNotIn(private_value, payload)

    def test_list_is_paginated(self):
        for index in range(3):
            company = make_company(self.creator, name=f'Công ty phân trang {index}')
            self._follow_at(company, days_ago=index)

        first = self.client.get(self.url, {'page_size': 2})
        second = self.client.get(self.url, {'page_size': 2, 'page': 2})

        self.assertEqual((first.data['count'], len(first.data['results'])), (3, 2))
        self.assertIsNotNone(first.data['next'])
        self.assertEqual(len(second.data['results']), 1)
        self.assertIsNone(second.data['next'])

    def test_unfollowed_company_leaves_the_list(self):
        self.follow()
        self.unfollow()

        response = self.client.get(self.url)

        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['results'], [])


class CompanyFollowConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.company = make_company(
            make_employer('follow-concurrent-creator@example.com'),
            name='Công ty Đồng Thời',
        )
        self.candidates = [
            make_candidate(f'follow-concurrent-{index}@example.com') for index in range(4)
        ]

    def _race(self, *commands):
        """Run each ``(command, candidate)`` on its own connection at once."""
        gate = Barrier(len(commands))

        def run(command, candidate):
            close_old_connections()
            try:
                gate.wait(timeout=5)
                command(company=self.company, candidate=candidate)
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=len(commands)) as pool:
            for future in [pool.submit(run, *command) for command in commands]:
                future.result(timeout=30)

    def _state(self):
        return (
            Company.objects.get(pk=self.company.pk).follower_count,
            CompanyFollow.objects.filter(company=self.company).count(),
        )

    def test_simultaneous_puts_create_one_row_and_increment_once(self):
        for followed, candidate in enumerate(self.candidates, start=1):
            self._race((follow_company, candidate), (follow_company, candidate))

            self.assertEqual(self._state(), (followed, followed))

    def test_simultaneous_follow_and_unfollow_leave_a_consistent_count(self):
        bystander, candidate = self.candidates[:2]
        follow_company(company=self.company, candidate=bystander)

        for _ in range(6):
            self._race((follow_company, candidate), (unfollow_company, candidate))

            follower_count, rows = self._state()
            self.assertEqual(follower_count, rows)
            self.assertIn(rows, (1, 2))

    def test_simultaneous_unfollows_decrement_once(self):
        bystander, candidate = self.candidates[:2]
        follow_company(company=self.company, candidate=bystander)

        for _ in range(4):
            follow_company(company=self.company, candidate=candidate)
            self._race((unfollow_company, candidate), (unfollow_company, candidate))

            self.assertEqual(self._state(), (1, 1))
