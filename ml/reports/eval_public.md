# Chuẩn ngoài: resume-job-description-fit, phần test

1759 cặp tiếng Anh (857 No Fit, 444 Potential Fit, 458 Good Fit), 71 tin, 477 CV. Tin của phần test có trong phần train: 0; CV của phần test có trong phần train: 476. Tạo bằng `ml/scripts/evaluate_public.py`.

| Mô hình | Spearman (cosine với ba mức) | AUC Good Fit so với No Fit | Cosine trung vị: No / Potential / Good |
| --- | ---: | ---: | --- |
| `e5-base-zs-v1` | 0,211 | 0,639 | 0,817 / 0,823 / 0,825 |
| `e5-base-ft-v1` | 0,346 | 0,707 | 0,583 / 0,702 / 0,679 |
| `e5-base-wise-v1` | 0,336 | 0,706 | 0,636 / 0,709 / 0,699 |
