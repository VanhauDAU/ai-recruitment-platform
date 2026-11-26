# Kiểm tra sơ bộ nhãn người – Claude

Người làm đồ án chấm mù 5/50 cặp kiểm chứng dự kiến. Chưa đủ để tính
kappa (cần từ 10 cặp), nên đây chỉ là kiểm tra sơ bộ: trùng tuyệt đối
4/5, lệch không quá 1 mức 5/5. Tạo bằng `ml/scripts/agreement.py`.

| Cặp | Tin | CV | Người | Claude | Lý do của người | Lý do của Claude |
| --- | --- | --- | ---: | ---: | --- | --- |
| #2 | JD-02 | CV-036 | 0 | 0 | khác ngành, không phù hợp | Telesales thuộc nhóm Kinh doanh, khác ngành CNTT (B6); 0/5 nhóm kỹ năng |
| #6 | JD-02 | CV-019 | 2 | 1 | thiếu frontend | Backend Developer cho tin Fullstack → vị trí gần (D1); cốt lõi backend Go/Node/Python/PHP THIẾU; 1/5 nhóm (REST); vị trí gần + ít kỹ năng → 1 (A2); KN 10 tháng/5 năm |
| #19 | JD-66 | CV-077 | 1 | 1 | khác vị trí nhưng cùng ngành | DevOps: cùng nhóm CNTT, khác nghề (B6); cốt lõi Fullstack/Python: không; 1/5 (AWS từ chứng chỉ, A4); TA IELTS 5.5 = Làm việc: trừ nhưng không xuống 0 (A3) |
| #20 | JD-66 | CV-071 | 0 | 0 | không phù hợp, khác ngành | Brand Marketing/PR: nhóm Marketing, khác ngành CNTT (B6); cốt lõi: không; 0/5 |
| #22 | JD-35 | CV-042 | 0 | 0 | không phù hợp, khác ngành | Kế toán công nợ, khác ngành (B6); 0/3 kỹ năng |
