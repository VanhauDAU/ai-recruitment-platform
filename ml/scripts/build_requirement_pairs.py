"""Cặp (câu yêu cầu của tin, câu của CV) để huấn luyện cross-encoder (kế hoạch bản 3, mục 3.4).

    ml/.venv/bin/python ml/scripts/build_requirement_pairs.py generate --limit 5   # thử
    ml/.venv/bin/python ml/scripts/build_requirement_pairs.py generate             # gọi Ollama, vài giờ
    ml/.venv/bin/python ml/scripts/build_requirement_pairs.py pairs                # ghép cặp, không gọi mô hình

Cross-encoder đọc cùng lúc một câu yêu cầu và một câu CV rồi cho xác suất câu CV đáp
ứng yêu cầu. Chỉ câu loại `skill` (kỹ năng, việc đã làm; `facts.requirement_kind`) được
dùng: bậc học, số năm, ngoại ngữ đã có tiêu chí riêng, phẩm chất cá nhân không đo
được từ CV.

Bước `generate`: với mỗi câu yêu cầu của 70 tin ngoài tập vàng và một mẫu tin
VietJobs, mô hình local viết ba câu CV: `met` đáp ứng yêu cầu, giữ tên riêng yêu cầu
nêu (công cụ, chứng chỉ…) nhưng không chép cấu trúc câu; `met_other` cùng ý bằng ngôn
ngữ còn lại (Việt/Anh); `near_miss` cùng nghề nhưng chưa đáp ứng (công cụ khác cùng
loại, quy mô nhỏ hơn). Câu chép lại yêu cầu (Jaccard từ ≥ 0,5) bị sinh lại. Bản đầu
của lời nhắc cấm dùng lại từ của yêu cầu, làm câu `met` né luôn tên chứng chỉ và công
cụ nên không còn đáp ứng thật; đã sửa trước khi sinh dữ liệu.
Lưu ở `ml/data/pairs/requirements.jsonl`; chạy lại thì bỏ qua câu đã có.

Bước `pairs` ghép nhãn, với ba cách chống việc mô hình học văn phong của máy sinh:
1. Ghép chéo: mỗi câu `met` và `met_other` vừa là dương với yêu cầu của nó (nhãn 1) vừa
   là âm với một yêu cầu khác cùng nhóm ngành (nhãn 0), nên văn phong và ngôn ngữ của câu
   không lộ nhãn. Ghép trong cùng phần train/dev để một câu không nằm ở cả hai phần.
2. Câu CV thật của kho huấn luyện, với cả ba nhãn: câu của CV neo vào chính tin đó
   được gán nhãn theo số kỹ năng danh mục mà nó nêu so với yêu cầu (`cv_met`,
   `cv_partial`, `cv_unmet`); câu của CV thuộc nhóm ngành khác, chọn theo TF-IDF giống
   yêu cầu nhất, nhãn 0 (`pipeline`). Lúc chạy, mọi câu mô hình gặp đều là câu CV, nên
   câu kiểu này phải có mặt ở cả nhãn dương lẫn nhãn âm.
3. `near_miss` nhãn 0,5 (liên quan, chưa đủ), là thiểu số.
Câu yêu cầu của 14 tin hiệu chỉnh luôn nằm ở dev, và câu CV neo vào các tin đó không
được dùng làm mẫu âm.
Kiểm tra "chỉ nhìn câu CV": một bộ phân loại chỉ đọc câu CV phải cho AUC gần 0,5;
cao hơn nghĩa là văn phong lộ nhãn. Chia train/dev theo tin. Kết quả:
`ml/data/pairs/reranker_train.jsonl`, `reranker_dev.jsonl`, `ml/reports/reranker_pairs.md`.
"""

import argparse
import json
import random
import re
import subprocess
import urllib.request
from collections import Counter, defaultdict

import pandas as pd
from build_gold_pairs import EXTENSION_JDS, GOLD_JDS
from generate_cvs import OLLAMA_URL, has_foreign_script, load_jobs
from paths import CALIBRATION_JOBS, JD_IMPORT_MAP, PAIRS_DIR, PROFILES_DIR, PUBLIC_DIR, REPO_ROOT, REPORTS_DIR, TRAIN_CV_DIR, TRAIN_CV_MANIFEST
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

SEED = 42
GOLD = {*GOLD_JDS, *EXTENSION_JDS}
MIN_WORDS = 4
VIETJOBS_JOBS = 300
MAX_REQUIREMENTS_PER_JOB = 8
COPY_JACCARD = 0.5
DEV_SHARE = 0.1
PIPELINE_NEGATIVES = 2
# Số câu CV thật lấy cho mỗi câu yêu cầu, theo nhãn (xem `cv_evidence_rows`).
CV_MET, CV_PARTIAL, CV_UNMET = 3, 1, 3
# Nhóm kỹ năng không được đếm (như `apps.skills.domain.UNCOUNTED_GROUPS` ở backend).
UNCOUNTED_GROUPS = ('Phẩm chất cá nhân', 'Tên vị trí')
RESPONSE_SCHEMA = {
    'type': 'object',
    'properties': {
        'met': {'type': 'string'},
        'met_other': {'type': 'string'},
        'near_miss': {'type': 'string'},
    },
    'required': ['met', 'met_other', 'near_miss'],
}
OUTPUT = PAIRS_DIR / 'requirements.jsonl'


def words(text):
    return set(re.findall(r'\w+', str(text).casefold()))


def jaccard(a, b):
    a, b = words(a), words(b)
    return len(a & b) / max(1, len(a | b))


def is_vietnamese(text):
    return any(char in 'ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ' for char in text.casefold())


def requirement_pool():
    """[{id, job, group, text}] câu yêu cầu loại `skill` của tin ngoài tập vàng và VietJobs."""
    codes = {value['job_public_id']: code for code, value in json.loads(JD_IMPORT_MAP.read_text(encoding='utf-8')).items()}  # fmt: skip
    groups = {job['code']: job['group'] for job in load_jobs()}
    pool = []
    for row in map(json.loads, (PROFILES_DIR / 'jd.jsonl').read_text(encoding='utf-8').splitlines()):
        code = codes.get(row['job_public_id'])
        if code is None or code in GOLD:
            continue
        skills = [item['text'] for item in row.get('requirements', []) if item['kind'] == 'skill' and len(item['text'].split()) >= MIN_WORDS]  # fmt: skip
        for index, text in enumerate(skills[:MAX_REQUIREMENTS_PER_JOB]):
            pool.append({'id': f'{code}-{index}', 'job': code, 'group': groups.get(code, ''), 'text': text})
    frame = pd.read_csv(PUBLIC_DIR / 'vietjobs' / 'VietJobs.csv').dropna(subset=['requirements_text'])
    frame = frame.drop_duplicates(subset=['requirements_text']).sample(VIETJOBS_JOBS, random_state=SEED)
    items = [{'id': f'VJ-{index}', 'kind': 'job', 'title': row.job_title, 'description': '', 'requirements': row.requirements_text} for index, row in enumerate(frame.itertuples())]  # fmt: skip
    categories = {f'VJ-{index}': row.category for index, row in enumerate(frame.itertuples())}
    payload = ''.join(json.dumps(item, ensure_ascii=False) + '\n' for item in items)
    result = subprocess.run(
        ['docker', 'compose', 'exec', '-T', 'backend', 'python', 'manage.py', 'matching_export_dataset', 'texts'],
        input=payload, capture_output=True, text=True, cwd=REPO_ROOT, check=True,
    )  # fmt: skip
    for row in map(json.loads, result.stdout.splitlines()):
        skills = [item['text'] for item in row.get('requirements', []) if item['kind'] == 'skill' and len(item['text'].split()) >= MIN_WORDS]  # fmt: skip
        for index, text in enumerate(skills[:MAX_REQUIREMENTS_PER_JOB]):
            pool.append({'id': f'{row["id"]}-{index}', 'job': row['id'], 'group': f'vj:{categories[row["id"]]}', 'text': text})  # fmt: skip
    return pool


# Động từ mở đầu do script chọn ngẫu nhiên từ cùng một danh sách cho cả câu đạt và câu
# gần đạt. Để mô hình tự chọn thì câu gần đạt luôn mở đầu "Tham gia", "Hỗ trợ": chữ mở
# đầu lộ nhãn.
OPENERS = {
    'tiếng Việt': ('Xây dựng', 'Triển khai', 'Thực hiện', 'Quản lý', 'Phụ trách', 'Thiết kế', 'Phân tích', 'Vận hành', 'Lập', 'Tham gia', 'Phối hợp', 'Chịu trách nhiệm'),
    'tiếng Anh': ('Built', 'Implemented', 'Delivered', 'Managed', 'Led', 'Designed', 'Analyzed', 'Operated', 'Prepared', 'Worked on', 'Coordinated', 'Handled'),
}  # fmt: skip


def prompt_for(requirement, rng):
    language, other = ('tiếng Việt', 'tiếng Anh') if is_vietnamese(requirement) else ('tiếng Anh', 'tiếng Việt')
    first, second = rng.choice(OPENERS[language]), rng.choice(OPENERS[language])
    return f"""Một tin tuyển dụng có câu yêu cầu sau:
"{requirement}"

Viết ba câu, mỗi câu là MỘT gạch đầu dòng (một dòng duy nhất, không xuống dòng) trong mục Kinh nghiệm của một CV hư cấu (kể việc đã làm, có kết quả cụ thể, 15–35 từ, không tên người, không tên công ty có thật):
- "met": viết bằng {language}, mở đầu bằng "{first}", cho thấy rõ người này ĐÁP ỨNG yêu cầu trên. Giữ đúng tên riêng mà yêu cầu nêu (công cụ, phần mềm, ngôn ngữ lập trình, chứng chỉ, tiêu chuẩn); yêu cầu cho nhiều lựa chọn thì dùng một lựa chọn. Phần còn lại diễn đạt bằng việc cụ thể đã làm, không chép cấu trúc câu của yêu cầu.
- "met_other": cùng ý với "met" nhưng viết bằng {other}.
- "near_miss": viết bằng {language}, mở đầu bằng "{second}", cùng nghề và nghe có vẻ liên quan nhưng KHÔNG đáp ứng yêu cầu (làm bằng công cụ hoặc chứng chỉ khác cùng loại, quy mô nhỏ hơn hẳn, chỉ làm một phần việc…). Không nhắc tên công cụ hay chứng chỉ mà yêu cầu nêu. Viết như một CV thật, chỉ kể điều đã làm; tuyệt đối không dùng từ phủ định (không, chưa, chẳng, not, never, without, no)."""


def call_model(model, prompt, seed):
    body = json.dumps({
        'model': model, 'messages': [{'role': 'user', 'content': prompt}], 'format': RESPONSE_SCHEMA,
        'stream': False, 'options': {'temperature': 0.7, 'seed': seed, 'num_ctx': 2048},
    }).encode()  # fmt: skip
    request = urllib.request.Request(OLLAMA_URL, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.loads(json.loads(response.read())['message']['content'])


# CV thật không kể điều mình chưa làm; câu "chưa đáp ứng" có phủ định là dấu vết của máy sinh.
_NEGATION = re.compile(r'(?<!\w)(?:không|chưa|chẳng|not|never|without|no)(?!\w)', re.IGNORECASE)
_BULLET = re.compile(r'^\s*[-–—•*·]+\s*')


def clean(text):
    """Bỏ ký hiệu gạch đầu dòng như bước tách câu của sản phẩm (`text.split_sentences`)."""
    return _BULLET.sub('', str(text).replace('%0A', ' ')).strip()


def rejection(requirement, written):
    """Lý do một bộ ba câu bị loại, hoặc None khi dùng được."""
    texts = [written[key] for key in ('met', 'met_other', 'near_miss')]
    checks = (
        ('câu quá ngắn hoặc nhiều dòng', any(len(text.split()) < 6 or '\n' in text for text in texts)),
        ('câu gần đạt có từ phủ định', bool(_NEGATION.search(written['near_miss']))),
        ('lẫn chữ ngoài Latin', has_foreign_script(written)),
        ('chép lại câu yêu cầu', jaccard(requirement, written['met']) >= COPY_JACCARD),
        ('sai ngôn ngữ', is_vietnamese(written['met']) != is_vietnamese(requirement)
         or is_vietnamese(written['met_other']) == is_vietnamese(requirement)),
    )  # fmt: skip
    return next((reason for reason, failed in checks if failed), None)


def generate(options):
    pool = requirement_pool()
    if options.limit:
        pool = pool[: options.limit]
    PAIRS_DIR.mkdir(parents=True, exist_ok=True)
    done = {json.loads(line)['id'] for line in OUTPUT.read_text(encoding='utf-8').splitlines()} if OUTPUT.exists() else set()  # fmt: skip
    skipped, reasons = 0, Counter()
    with OUTPUT.open('a', encoding='utf-8') as output:
        for number, item in enumerate(pool):
            if item['id'] in done:
                continue
            for attempt in range(3):
                seed = SEED * 1000 + number * 3 + attempt
                try:
                    written = call_model(options.model, prompt_for(item['text'], random.Random(seed)), seed)
                    written = {key: clean(written[key]) for key in RESPONSE_SCHEMA['required']}
                except (OSError, ValueError, KeyError):
                    reasons['mô hình trả lời hỏng'] += 1
                    continue
                reason = rejection(item['text'], written)
                reasons[reason] += reason is not None
                if reason is None:
                    output.write(json.dumps({**item, **{key: written[key].strip() for key in RESPONSE_SCHEMA['required']}}, ensure_ascii=False) + '\n')  # fmt: skip
                    output.flush()
                    break
            else:
                skipped += 1
            if number % 25 == 0:
                print(f'{number + 1}/{len(pool)} câu yêu cầu, bỏ {skipped}', flush=True)
    print(f'Xong: {OUTPUT}; bỏ {skipped} câu không sinh được sau 3 lần. Lượt sinh bị loại theo lý do: {dict(reasons)}')


def calibration_jobs():
    """14 tin hiệu chỉnh (`build_train_pairs.py`): câu yêu cầu và CV của chúng không vào huấn luyện."""
    return set(json.loads(CALIBRATION_JOBS.read_text(encoding='utf-8'))['jobs'])


def train_cv_sentences():
    """[(nhóm ngành của tin neo, câu kinh nghiệm)] của CV huấn luyện đã qua cổng chất lượng."""
    manifest = json.loads(TRAIN_CV_MANIFEST.read_text(encoding='utf-8'))
    gate = json.loads((TRAIN_CV_DIR / 'gate.json').read_text(encoding='utf-8'))
    groups = {job['code']: job['group'] for job in load_jobs()}
    held_out = calibration_jobs()
    sentences = []
    for code, facts in manifest.items():
        if gate.get(code, ['chưa kiểm']) or facts['anchor_job'] in held_out:
            continue
        data = json.loads((TRAIN_CV_DIR / f'{code}.json').read_text(encoding='utf-8'))
        for job in data.get('experience', []):
            sentences += [(groups.get(facts['anchor_job'], ''), line) for line in job['highlights']]
    return sentences


def skill_finder():
    """Hàm trả tập kỹ năng danh mục được nêu tên trong một câu (theo `profiles/skills.jsonl`)."""
    names = {}
    for line in (PROFILES_DIR / 'skills.jsonl').read_text(encoding='utf-8').splitlines():
        skill = json.loads(line)
        if skill['group'] not in UNCOUNTED_GROUPS:
            names.update({term: skill['name'] for term in skill['terms'] if len(term) >= 2})
    ordered = sorted(names, key=len, reverse=True)
    pattern = re.compile(r'(?<![\w+#])(?:' + '|'.join(map(re.escape, ordered)) + r')(?![\w+#])', re.IGNORECASE)
    return lambda text: {names[match.group(0).casefold()] for match in pattern.finditer(str(text))}


def cv_evidence_rows(written, named, rng):
    """Cặp có câu CV thật của kho huấn luyện, nhãn theo kỹ năng được nêu tên.

    Với mỗi câu yêu cầu của tin thật có nêu kỹ năng trong danh mục, lấy các gạch đầu dòng
    của CV huấn luyện neo vào chính tin đó: nêu từ một nửa số kỹ năng của yêu cầu là đạt
    (1), nêu ít hơn là liên quan chưa đủ (0,5), chỉ nêu kỹ năng khác là không đạt (0).
    Không có các cặp này thì câu viết kiểu CV chỉ xuất hiện với nhãn 0 (nguồn `pipeline`),
    và mô hình học "văn phong CV nghĩa là không đạt" trong khi lúc chạy mọi câu đều là câu CV.
    """
    manifest = json.loads(TRAIN_CV_MANIFEST.read_text(encoding='utf-8'))
    gate = json.loads((TRAIN_CV_DIR / 'gate.json').read_text(encoding='utf-8'))
    bullets = defaultdict(list)
    for code, facts in manifest.items():
        if gate.get(code, ['chưa kiểm']):
            continue
        data = json.loads((TRAIN_CV_DIR / f'{code}.json').read_text(encoding='utf-8'))
        for section in ('experience', 'projects'):
            for item in data.get(section, []):
                bullets[facts['anchor_job']] += [(line, named(line)) for line in item.get('highlights', [])]
    rows = []
    for item in written:
        wanted = named(item['text'])
        if not wanted or item['job'] not in bullets:
            continue
        groups = defaultdict(list)
        for line, has in bullets[item['job']]:
            share = len(has & wanted) / len(wanted)
            if share >= 0.5:
                groups['cv_met'].append(line)
            elif share > 0:
                groups['cv_partial'].append(line)
            elif has:
                groups['cv_unmet'].append(line)
        for source, label, limit in (('cv_met', 1.0, CV_MET), ('cv_partial', 0.5, CV_PARTIAL), ('cv_unmet', 0.0, CV_UNMET)):
            for line in rng.sample(sorted(set(groups[source])), min(limit, len(set(groups[source])))):
                rows.append({'job': item['job'], 'requirement': item['text'], 'sentence': line, 'label': label, 'source': source})  # fmt: skip
    return rows


def pairs(options):
    rng = random.Random(SEED)
    written = [json.loads(line) for line in OUTPUT.read_text(encoding='utf-8').splitlines()]
    # Chia train/dev theo tin trước khi ghép chéo, để một câu không nằm ở cả hai phần.
    # Dev: mọi tin hiệu chỉnh (ngưỡng của sản phẩm sẽ chọn trên cặp thật của các tin này)
    # cộng một phần ngẫu nhiên các tin còn lại.
    held_out = calibration_jobs()
    jobs = sorted({item['job'] for item in written} - held_out)
    rng.shuffle(jobs)
    dev_jobs = held_out | set(jobs[: max(1, int(len(jobs) * DEV_SHARE))])
    by_group = defaultdict(list)
    for item in written:
        by_group[(item['group'], item['job'] in dev_jobs)].append(item)
    rows = []
    for item in written:
        rows.append({'job': item['job'], 'requirement': item['text'], 'sentence': item['met'], 'label': 1.0, 'source': 'met'})  # fmt: skip
        rows.append({'job': item['job'], 'requirement': item['text'], 'sentence': item['met_other'], 'label': 1.0, 'source': 'met_other'})  # fmt: skip
        rows.append({'job': item['job'], 'requirement': item['text'], 'sentence': item['near_miss'], 'label': 0.5, 'source': 'near_miss'})  # fmt: skip
        # Ghép chéo: cả hai câu đáp ứng của yêu cầu này là âm với một yêu cầu khác cùng nhóm
        # ngành và cùng phần train/dev. Câu ở ngôn ngữ còn lại cũng phải có đủ hai nhãn, không
        # thì "câu tiếng Anh" trở thành dấu hiệu của nhãn dương.
        others = [other for other in by_group[(item['group'], item['job'] in dev_jobs)] if other['job'] != item['job']]
        for key, source in (('met', 'cross'), ('met_other', 'cross_other')):
            if others:
                other = rng.choice(others)
                rows.append({'job': other['job'], 'requirement': other['text'], 'sentence': item[key], 'label': 0.0, 'source': source})  # fmt: skip

    rows += cv_evidence_rows(written, skill_finder(), rng)
    sentences = train_cv_sentences()
    if sentences:
        vectorizer = TfidfVectorizer(sublinear_tf=True).fit([text for _, text in sentences] + [item['text'] for item in written])
        matrix = vectorizer.transform([text for _, text in sentences])
        for item in written:
            if item['group'].startswith('vj:'):
                continue  # nhóm ngành của VietJobs không so được với nhóm của tin thật
            scores = (matrix @ vectorizer.transform([item['text']]).T).toarray().ravel()
            ranked = [index for index in scores.argsort()[::-1] if sentences[index][0] != item['group']]
            for index in ranked[:PIPELINE_NEGATIVES]:
                rows.append({'job': item['job'], 'requirement': item['text'], 'sentence': sentences[index][1], 'label': 0.0, 'source': 'pipeline'})  # fmt: skip

    train = [row for row in rows if row['job'] not in dev_jobs]
    dev = [row for row in rows if row['job'] in dev_jobs]
    for name, part in (('reranker_train.jsonl', train), ('reranker_dev.jsonl', dev)):
        with (PAIRS_DIR / name).open('w', encoding='utf-8') as output:
            for row in part:
                output.write(json.dumps(row, ensure_ascii=False) + '\n')

    # Kiểm tra "chỉ nhìn câu CV": dương (1) với âm (0), bỏ mức 0,5.
    binary = [row for row in rows if row['label'] != 0.5]
    split = [row['job'] in dev_jobs for row in binary]
    fit_rows = [row for row, is_dev in zip(binary, split, strict=True) if not is_dev]
    test_rows = [row for row, is_dev in zip(binary, split, strict=True) if is_dev]
    hypothesis_only = float('nan')
    if len(fit_rows) >= 50 and len({row['label'] for row in test_rows}) == 2:
        vectorizer = TfidfVectorizer(sublinear_tf=True, ngram_range=(1, 2), min_df=2)
        features = vectorizer.fit_transform(row['sentence'] for row in fit_rows)
        model = LogisticRegression(max_iter=2000).fit(features, [row['label'] for row in fit_rows])
        hypothesis_only = roc_auc_score([row['label'] for row in test_rows], model.predict_proba(vectorizer.transform(row['sentence'] for row in test_rows))[:, 1])  # fmt: skip

    counts = Counter(row['source'] for row in rows)
    labels = Counter(row['label'] for row in rows)
    lines = [
        '# Dữ liệu huấn luyện cross-encoder (yêu cầu ↔ câu CV)',
        '',
        f'{len(written)} câu yêu cầu loại `skill` ({sum(not item["job"].startswith("VJ") for item in written)} từ tin thật ngoài tập vàng, '
        f'phần còn lại từ VietJobs), {len(rows)} cặp; train {len(train)}, dev {len(dev)} (chia theo tin). '
        'Tạo bằng `ml/scripts/build_requirement_pairs.py`.',
        '',
        '| Nguồn | Nhãn | Số cặp |',
        '| --- | ---: | ---: |',
        f'| `met` (câu đáp ứng, cùng ngôn ngữ) | 1 | {counts["met"]} |',
        f'| `met_other` (câu đáp ứng, ngôn ngữ còn lại) | 1 | {counts["met_other"]} |',
        f'| `near_miss` (liên quan, chưa đủ) | 0,5 | {counts["near_miss"]} |',
        f'| `cross` (câu đáp ứng của yêu cầu khác cùng nhóm) | 0 | {counts["cross"]} |',
        f'| `cross_other` (như trên, câu ở ngôn ngữ còn lại) | 0 | {counts["cross_other"]} |',
        f'| `pipeline` (câu CV huấn luyện khác nhóm ngành, TF-IDF gần nhất) | 0 | {counts["pipeline"]} |',
        f'| `cv_met` (câu CV của chính tin, nêu từ nửa số kỹ năng của yêu cầu) | 1 | {counts["cv_met"]} |',
        f'| `cv_partial` (câu CV của chính tin, nêu dưới nửa số kỹ năng) | 0,5 | {counts["cv_partial"]} |',
        f'| `cv_unmet` (câu CV của chính tin, chỉ nêu kỹ năng khác) | 0 | {counts["cv_unmet"]} |',
        '',
        f'Nhãn: 1: {labels[1.0]}, 0,5: {labels[0.5]}, 0: {labels[0.0]}.',
        '',
        'Kiểm tra "chỉ nhìn câu CV" (TF-IDF + hồi quy logistic, không thấy câu yêu cầu): AUC '
        + f'{hypothesis_only:.3f}'.replace('.', ',')
        + ' trên dev. Gần 0,5 nghĩa là văn phong của câu không lộ nhãn.',
    ]
    REPORTS_DIR.joinpath('reranker_pairs.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('step', choices=['generate', 'pairs'])
    parser.add_argument('--model', default='qwen2.5:7b')
    parser.add_argument('--limit', type=int, default=0)
    options = parser.parse_args()
    {'generate': generate, 'pairs': pairs}[options.step](options)


if __name__ == '__main__':
    main()
