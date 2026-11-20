"""Owner view and bearer share links: immutable version pinning, audit, expiry and IDOR."""

from copy import deepcopy
from datetime import timedelta
from hashlib import sha256

from django.urls import reverse
from django.utils import timezone

from apps.cvs.models import CvAccessLog, CvSharedLink

from .api_case import CvApiTestCase


class CvSharingApiTests(CvApiTestCase):
    def test_owner_view_and_shared_link_are_pinned_to_an_immutable_version_and_audited(self):
        cv = self.create_cv()
        draft = self.client.get(self.draft_url(cv)).data
        save_payload = {
            key: deepcopy(draft[key])
            for key in ('schema_version', 'content_json', 'layout_json', 'style_json')
        }
        save_payload['content_json']['personal_info']['full_name'] = 'Immutable Candidate'
        self.client.put(
            self.draft_url(cv), save_payload, format='json', HTTP_IF_MATCH='"lock-version-0"'
        )
        saved = self.client.post(
            reverse('cv-save-version', kwargs={'public_id': cv.public_id}),
            format='json',
            HTTP_IF_MATCH='"lock-version-1"',
        )
        self.assertEqual(saved.status_code, 201, saved.data)

        mutable_payload = deepcopy(save_payload)
        mutable_payload['content_json']['personal_info']['full_name'] = 'Mutable Draft Only'
        self.client.put(
            self.draft_url(cv), mutable_payload, format='json', HTTP_IF_MATCH='"lock-version-1"'
        )

        owner_view = self.client.get(
            self.owner_view_url(cv),
            REMOTE_ADDR='203.0.113.9',
            HTTP_USER_AGENT='owner-browser',
        )
        self.assertEqual(owner_view.status_code, 200, owner_view.data)
        self.assertEqual(owner_view.data['version']['public_id'], saved.data['public_id'])
        self.assertEqual(
            owner_view.data['version']['content_json']['personal_info']['full_name'],
            'Immutable Candidate',
        )
        self.assertNotIn('draft', owner_view.data)

        created = self.client.post(
            self.shared_links_url(cv),
            {'version_public_id': saved.data['public_id']},
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        raw_token = created.data['token']
        self.assertGreaterEqual(
            len(raw_token), 43
        )  # token_urlsafe(32): at least 256 bits of entropy
        link = CvSharedLink.objects.get(public_id=created.data['link']['public_id'])
        self.assertEqual(link.version.public_id, saved.data['public_id'])
        self.assertEqual(link.token_hash, sha256(raw_token.encode('utf-8')).hexdigest())
        self.assertNotEqual(link.token_hash, raw_token)
        self.assertNotIn('token', created.data['link'])

        shared = self.client.get(
            reverse('cv-shared-link-public', kwargs={'token': raw_token}),
            REMOTE_ADDR='198.51.100.4',
            HTTP_USER_AGENT='shared-browser',
        )
        self.assertEqual(shared.status_code, 200, shared.data)
        self.assertEqual(shared.data['version']['public_id'], saved.data['public_id'])
        self.assertEqual(
            shared.data['version']['content_json']['personal_info']['full_name'],
            'Immutable Candidate',
        )
        self.assertNotIn('plain_text', shared.data['version'])

        logs = CvAccessLog.objects.filter(cv=cv).order_by('accessed_at')
        self.assertEqual(logs.count(), 2)
        owner_log, shared_log = logs
        self.assertEqual(owner_log.access_channel, CvAccessLog.AccessChannel.OWNER_VIEW)
        self.assertEqual(owner_log.actor_user_id, self.candidate.id)
        self.assertEqual(shared_log.access_channel, CvAccessLog.AccessChannel.SHARED_LINK)
        self.assertEqual(shared_log.shared_link_id, link.id)
        self.assertEqual(len(shared_log.ip_hash), 64)
        self.assertEqual(len(shared_log.user_agent_hash), 64)
        self.assertNotEqual(shared_log.ip_hash, '198.51.100.4')
        self.assertNotEqual(shared_log.user_agent_hash, 'shared-browser')
        self.assertNotIn('content_json', {field.name for field in CvAccessLog._meta.fields})

    def test_shared_link_expiry_revoke_and_invalid_tokens_return_404(self):
        cv = self.create_cv()
        created = self.client.post(self.shared_links_url(cv), format='json')
        self.assertEqual(created.status_code, 201, created.data)
        raw_token = created.data['token']
        public_url = reverse('cv-shared-link-public', kwargs={'token': raw_token})
        self.assertEqual(self.client.get(public_url).status_code, 200)

        revoke = self.client.delete(
            reverse(
                'cv-shared-link-revoke',
                kwargs={
                    'public_id': cv.public_id,
                    'link_public_id': created.data['link']['public_id'],
                },
            ),
        )
        self.assertEqual(revoke.status_code, 204)
        self.assertEqual(self.client.get(public_url).status_code, 404)
        self.assertEqual(
            self.client.get(
                reverse('cv-shared-link-public', kwargs={'token': 'not-a-real-token'})
            ).status_code,
            404,
        )

        expiring = self.client.post(self.shared_links_url(cv), format='json')
        link = CvSharedLink.objects.get(public_id=expiring.data['link']['public_id'])
        CvSharedLink.objects.filter(pk=link.pk).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )
        self.assertEqual(
            self.client.get(
                reverse('cv-shared-link-public', kwargs={'token': expiring.data['token']})
            ).status_code,
            404,
        )

    def _set(self, key, value):
        from apps.sitecontent.models import SiteSetting

        SiteSetting.objects.update_or_create(key=key, defaults={'value': value})

    def test_admin_share_window_sets_the_default_and_caps_the_expiry(self):
        self._set('cv_share_default_days', 7)
        self._set('cv_share_max_days', 10)
        cv = self.create_cv()

        created = self.client.post(self.shared_links_url(cv), format='json')
        self.assertEqual(created.status_code, 201, created.data)
        link = CvSharedLink.objects.get(public_id=created.data['link']['public_id'])
        self.assertAlmostEqual(
            (link.expires_at - timezone.now()).total_seconds(),
            timedelta(days=7).total_seconds(),
            delta=60,
        )
        too_long = self.client.post(
            self.shared_links_url(cv),
            {'expires_at': (timezone.now() + timedelta(days=11)).isoformat()},
            format='json',
        )
        self.assertEqual(too_long.status_code, 403)

    def test_old_link_without_expiry_stops_after_the_admin_maximum(self):
        cv = self.create_cv()
        created = self.client.post(self.shared_links_url(cv), format='json')
        public_url = reverse('cv-shared-link-public', kwargs={'token': created.data['token']})
        CvSharedLink.objects.filter(public_id=created.data['link']['public_id']).update(
            expires_at=None, created_at=timezone.now() - timedelta(days=40)
        )
        self.assertEqual(self.client.get(public_url).status_code, 200)

        self._set('cv_share_max_days', 30)

        self.assertEqual(self.client.get(public_url).status_code, 404)

    def test_turning_sharing_off_blocks_new_and_existing_links(self):
        cv = self.create_cv()
        created = self.client.post(self.shared_links_url(cv), format='json')
        public_url = reverse('cv-shared-link-public', kwargs={'token': created.data['token']})

        self._set('cv_share_enabled', False)

        self.assertEqual(self.client.get(public_url).status_code, 404)
        self.assertEqual(
            self.client.post(self.shared_links_url(cv), format='json').status_code, 403
        )
        self._set('cv_share_enabled', True)
        self.assertEqual(self.client.get(public_url).status_code, 200)

    def test_owner_view_and_shared_link_management_block_idor(self):
        cv = self.create_cv()
        created = self.client.post(self.shared_links_url(cv), format='json')
        self.client.force_authenticate(self.other_candidate)

        self.assertEqual(self.client.get(self.owner_view_url(cv)).status_code, 404)
        self.assertEqual(self.client.get(self.shared_links_url(cv)).status_code, 404)
        self.assertEqual(
            self.client.post(self.shared_links_url(cv), format='json').status_code, 404
        )
        self.assertEqual(
            self.client.delete(
                reverse(
                    'cv-shared-link-revoke',
                    kwargs={
                        'public_id': cv.public_id,
                        'link_public_id': created.data['link']['public_id'],
                    },
                )
            ).status_code,
            404,
        )
