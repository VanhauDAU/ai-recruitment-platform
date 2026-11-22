<!--
GHI CHÚ CHO SINH VIÊN — xóa khối này trước khi dán vào Word.

- Bản Word dựng sẵn: Chuong-1-Gioi-thieu-tong-quan.docx (cùng thư mục).
- Tài liệu tham khảo [1]–[8] nằm ở cuối tệp này. Khi gộp vào báo cáo, đánh số lại
  theo thứ tự xuất hiện của toàn bộ báo cáo.
- Số liệu dữ liệu ở mục 1.4.2 lấy từ ml/data ngày 21/11/2026. Kho CV huấn luyện
  (1.074 CV) còn đang được sinh và lọc, nên chốt lại số cuối trước khi nộp.
- Kiểm tra lại các tiêu chí chấm điểm sau khi làm xong hybrid-v2, vì địa điểm có
  thể bị bỏ.
-->

# GIỚI THIỆU TỔNG QUAN

## 1.1. Giới thiệu

Ở ngoài nước, các nền tảng tuyển dụng đã chuyển từ việc chỉ hiển thị tin tuyển dụng sang hỗ trợ đánh giá mức độ phù hợp giữa ứng viên và công việc. LinkedIn so sánh hồ sơ của thành viên với yêu cầu của tin tuyển dụng và cho người tìm việc biết họ đáp ứng các yêu cầu về kỹ năng, kinh nghiệm, học vấn đến đâu [1]. Về mặt nghiên cứu, bài toán đối sánh ứng viên – công việc (person–job fit) đã được giải quyết bằng các mạng nơ-ron huấn luyện trên dữ liệu tuyển dụng lịch sử [2]. Một hướng khác là tinh chỉnh các mô hình biểu diễn câu huấn luyện sẵn như Sentence-BERT [3]. Hướng này cần ít dữ liệu hơn và cho kết quả tốt hơn TF-IDF trên dữ liệu ghép cặp ứng viên – công việc [4]. Đạo luật Trí tuệ nhân tạo của Liên minh châu Âu xếp các hệ thống AI dùng để lọc hồ sơ và đánh giá ứng viên vào nhóm rủi ro cao [5]. Vì vậy, các hệ thống loại này cần minh bạch, có giải thích, và để con người ra quyết định cuối cùng.

Ở trong nước, tuyển dụng trực tuyến phát triển chủ yếu qua các nền tảng như TopCV, VietnamWorks và ITviec. Các nền tảng này cung cấp chức năng đăng tin, tìm việc, tạo CV và quản lý hồ sơ ứng tuyển. TopCV đã có chức năng gợi ý việc làm theo CV và phân tích CV với mô tả công việc [6]. Tuy nhiên, phương pháp tính điểm và kết quả đánh giá của các sản phẩm thương mại này không được công bố. Dữ liệu tuyển dụng tại Việt Nam còn có một đặc thù: tin tuyển dụng và CV được viết bằng cả tiếng Việt lẫn tiếng Anh.

Từ thực tế trên, đề tài xây dựng một website tuyển dụng có đủ luồng nghiệp vụ cho ứng viên, nhà tuyển dụng (NTD) và quản trị viên. Website tích hợp một mô-đun đối sánh ngữ nghĩa giữa CV và mô tả công việc (Job Description – JD) do đề tài tự xây dựng. Mô-đun dùng mô hình biểu diễn câu đa ngôn ngữ mã nguồn mở [7], chạy trên máy chủ của hệ thống, có giải thích kết quả theo từng tiêu chí, và được đánh giá bằng số liệu trên tập dữ liệu có gán nhãn.

## 1.2. Lý do chọn đề tài

Tuyển dụng trực tuyến giúp doanh nghiệp tiếp cận nhiều ứng viên, nhưng cũng làm tăng số hồ sơ mà NTD phải xử lý cho mỗi tin. NTD phải đọc từng CV và đối chiếu với các yêu cầu về kỹ năng, kinh nghiệm, học vấn, cấp bậc và ngoại ngữ. Việc này tốn thời gian và kết quả phụ thuộc vào người đọc. Ở phía ứng viên, người tìm việc khó tự đánh giá CV của mình đáp ứng tin tuyển dụng đến đâu và còn thiếu kỹ năng gì.

Các công cụ sàng lọc theo từ khóa chỉ ghi nhận sự trùng lặp bề mặt của văn bản. Một CV ghi "ReactJS" có thể không khớp với yêu cầu "React". Một CV ghi "xây dựng API bằng Django" có thể bị chấm thấp so với yêu cầu "phát triển backend Python", dù hai nội dung tương đương. Hạn chế này càng rõ khi CV và tin tuyển dụng khác ngôn ngữ.

CV chứa nhiều dữ liệu cá nhân, và Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 có hiệu lực từ ngày 01/01/2026 [8]. Nếu mỗi lần phân tích CV đều gửi nội dung sang dịch vụ AI bên ngoài, hệ thống phải kiểm soát thêm việc chuyển dữ liệu cho bên thứ ba và phải trả chi phí theo từng lượt gọi. Xử lý phần đối sánh ngay trên máy chủ của hệ thống tránh được cả hai vấn đề này.

Xuất phát từ thực trạng trên, đề tài "Xây dựng website tuyển dụng ProCV tích hợp AI hỗ trợ phân tích CV và đối sánh ngữ nghĩa với mô tả công việc" được lựa chọn. Đề tài có khả năng ứng dụng theo các hướng sau:

* Hệ thống có thể dùng cho doanh nghiệp tự tuyển dụng, đơn vị dịch vụ tuyển dụng, hoặc trung tâm hỗ trợ việc làm của các trường đại học.
* Mô-đun đối sánh được tách riêng, có thể dùng lại cho các bài toán ghép cặp tương tự, như gợi ý khóa học theo kỹ năng còn thiếu.
* Mô hình chạy cục bộ, nên chi phí vận hành không tăng theo số lượt phân tích CV.

## 1.3. Mục tiêu

Đề tài xây dựng website tuyển dụng ProCV phục vụ ba nhóm người dùng là ứng viên, NTD và quản trị viên. Website tích hợp mô-đun AI đối sánh ngữ nghĩa CV–JD dùng cho cả hai phía: ứng viên dùng để phân tích CV, NTD dùng để sàng lọc hồ sơ.

Các mục tiêu cụ thể của đề tài bao gồm:

* Xây dựng ba phân hệ với luồng nghiệp vụ khép kín: xác thực doanh nghiệp, đăng tin và hậu kiểm tin, tìm việc, tạo CV, ứng tuyển và xử lý hồ sơ.
* Trích xuất thông tin có cấu trúc (kỹ năng, kinh nghiệm, học vấn, ngoại ngữ) từ CV tạo trên hệ thống và CV tải lên dạng PDF/DOCX, bằng tiếng Việt và tiếng Anh.
* Xây dựng mô-đun đối sánh CV–JD chạy cục bộ. Kết quả gồm điểm tổng, điểm theo tiêu chí, kỹ năng khớp và còn thiếu, cùng gợi ý cải thiện CV. Mô-đun phải cho kết quả tốt hơn các phương pháp cơ sở TF-IDF và BM25 trên tập kiểm tra có gán nhãn.
* Tinh chỉnh mô hình biểu diễn câu trên dữ liệu của đề tài và đánh giá tác động so với mô hình gốc.
* Ứng dụng mô-đun cho ứng viên (phân tích mức phù hợp, việc làm gợi ý) và cho NTD (xếp hạng hồ sơ ứng tuyển kèm lý do). AI chỉ phân tích CV đã được ứng viên đồng ý và không tự động loại hồ sơ.
* Bảo đảm chất lượng và an toàn hệ thống bằng kiểm thử tự động trong quy trình tích hợp liên tục (độ phủ mã backend tối thiểu 84%), phân quyền theo cổng và quét mã độc tệp tải lên.

## 1.4. Đối tượng, phạm vi nghiên cứu

### 1.4.1. Đối tượng nghiên cứu

**Hệ thống tuyển dụng trực tuyến:** quy trình nghiệp vụ giữa ứng viên, NTD và quản trị viên, gồm xác thực doanh nghiệp, vòng đời tin tuyển dụng và hồ sơ ứng tuyển, phân quyền trong công ty và hậu kiểm tin.

**Đối sánh ngữ nghĩa CV–JD:** các phương pháp từ mô hình túi từ (TF-IDF, BM25) đến mô hình biểu diễn câu đa ngôn ngữ theo kiến trúc bi-encoder và cross-encoder; kỹ thuật tinh chỉnh mô hình; các chỉ số đánh giá xếp hạng.

**Trích xuất thông tin từ CV:** đọc văn bản từ tệp PDF và DOCX, xử lý bố cục nhiều cột và dấu tiếng Việt, nhận diện các mục kỹ năng, kinh nghiệm, học vấn và ngoại ngữ.

**Kiến trúc và kiểm thử phần mềm:** kiến trúc phân lớp, xử lý tác vụ nền bằng hàng đợi, tìm kiếm vector trong cơ sở dữ liệu, kiểm thử tự động nhiều tầng.

### 1.4.2. Phạm vi nghiên cứu

**Về công nghệ:** backend dùng Django và Django REST Framework; frontend dùng React, Vite và Ant Design; cơ sở dữ liệu PostgreSQL có phần mở rộng pgvector; tác vụ nền dùng Celery và Redis; mô hình AI chạy bằng PyTorch và sentence-transformers; hệ thống đóng gói bằng Docker Compose.

**Về chức năng:** phân hệ ứng viên gồm tìm việc, quản lý CV, ứng tuyển, phân tích mức phù hợp và việc làm gợi ý. Phân hệ NTD gồm xác thực doanh nghiệp, quản lý công ty, chiến dịch, tin tuyển dụng, hồ sơ ứng tuyển và xếp hạng hồ sơ bằng AI. Phân hệ quản trị gồm quản lý tài khoản, duyệt xác thực doanh nghiệp, hậu kiểm tin và quản lý nội dung. Thanh toán trực tuyến không thuộc phạm vi của đề tài.

**Về trí tuệ nhân tạo:** trọng tâm là mô-đun đối sánh CV–JD dùng mô hình multilingual-e5-base [7], được tinh chỉnh và chạy cục bộ. Điểm phù hợp kết hợp mức liên quan ngữ nghĩa với các tiêu chí kỹ năng, kinh nghiệm, học vấn, cấp bậc và ngoại ngữ. Gợi ý cải thiện CV được sinh bằng luật, không dùng mô hình ngôn ngữ lớn. Các chức năng soạn nháp tin tuyển dụng và nhập CV từ tệp có gọi dịch vụ AI bên ngoài, nhưng không thuộc phạm vi đánh giá.

**Về dữ liệu:**

* Tin tuyển dụng: 100 tin thực tế nhập vào hệ thống từ các tin đăng công khai (78 tin tiếng Việt, 22 tin tiếng Anh, thuộc 8 nhóm ngành), và 48.092 tin tuyển dụng tiếng Việt của bộ dữ liệu công khai VietJobs dùng để xây dựng dữ liệu huấn luyện.
* CV: để bảo vệ dữ liệu cá nhân, đề tài không dùng CV của người thật. Dữ liệu gồm 1.174 CV giả lập do mô hình ngôn ngữ chạy cục bộ sinh ra (100 CV cho đánh giá, 1.074 CV cho huấn luyện), 51 tệp PDF dựng từ các CV này để đánh giá khâu trích xuất, và 8.000 cặp CV–JD tiếng Anh của bộ dữ liệu công khai resume-job-description-fit.
* Tập đánh giá: 300 cặp CV–JD thuộc 30 tin. Mỗi cặp được gán mức phù hợp từ 0 đến 4 theo rubric và chia thành tập kiểm định và tập kiểm tra.

**Về giới hạn:**

* Hệ thống là ứng dụng web có giao diện tương thích thiết bị di động, chưa có ứng dụng di động riêng, và chưa vận hành với người dùng thật.
* Chức năng NTD tìm kiếm hồ sơ ứng viên bằng AI chưa được hiện thực.
* Kết quả đánh giá mô hình dựa trên CV giả lập, nên chưa đại diện đầy đủ cho dữ liệu tuyển dụng thực tế.

---

## Tài liệu tham khảo của chương 1 (số tạm)

[1] LinkedIn, "Find how you match up with jobs on LinkedIn," LinkedIn Help. https://www.linkedin.com/help/linkedin/answer/a7120158 (truy cập 21/11/2026).

[2] C. Zhu, H. Zhu, H. Xiong, C. Ma, F. Xie, P. Ding, P. Li, "Person-Job Fit: Adapting the Right Talent for the Right Job with Joint Representation Learning," *ACM Transactions on Management Information Systems*, vol. 9, no. 3, 2018.

[3] N. Reimers, I. Gurevych, "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks," in *Proc. EMNLP-IJCNLP*, 2019.

[4] D. Lavi, V. Medentsiy, D. Graus, "conSultantBERT: Fine-tuned Siamese Sentence-BERT for Matching Jobs and Job Seekers," in *Workshop on Recommender Systems for Human Resources (RecSys in HR)*, 2021.

[5] European Union, "Regulation (EU) 2024/1689 (Artificial Intelligence Act), Annex III, point 4." https://artificialintelligenceact.eu/annex/3/ (truy cập 21/11/2026).

[6] TopCV, "Điều kiện giao dịch chung." https://www.topcv.vn/dieu-kien-giao-dich-chung (truy cập 21/11/2026).

[7] L. Wang, N. Yang, X. Huang, L. Yang, R. Majumder, F. Wei, "Multilingual E5 Text Embeddings: A Technical Report," arXiv:2402.05672, 2024.

[8] Quốc hội nước CHXHCN Việt Nam, *Luật Bảo vệ dữ liệu cá nhân*, số 91/2025/QH15, hiệu lực từ ngày 01/01/2026.
