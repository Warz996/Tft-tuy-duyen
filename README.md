# 🐳 Giải tùy duyên — TFT Companion

Website quản lý giải TFT Checkmate và chia team ngẫu nhiên. Giữ phong cách nền xanh đêm, cyan và cá voi của bản gốc; bổ sung giao diện responsive, điểm nhấn mint/vàng và tab riêng cho chia team.

## Mới: chia sẻ bảng điểm trực tiếp

Đã thêm **đăng nhập Admin + link chỉ xem**. Xem [HUONG-DAN-LIVE.md](HUONG-DAN-LIVE.md) để tạo project Supabase, cấp quyền Admin và cấu hình trước khi dùng online. Cập nhật cho người xem bằng polling mỗi 3 giây. Phân quyền ghi được thực thi tại database.

Trang chính dùng để quản lý; `watch.html?room=...` chỉ để xem. Các phần bên dưới mô tả tính năng giải và chế độ cục bộ vẫn được giữ lại.

## Mở ngay

Giải nén rồi mở `index.html` bằng Chrome, Edge hoặc Firefox. Giữ toàn bộ các file HTML/CSS/JS trong gói cùng thư mục. Chế độ cục bộ không cần npm, tài khoản hay backend. Chế độ trực tiếp cần cấu hình Supabase. Trang không tải thư viện hoặc font từ bên ngoài.

Trình duyệt có thể giới hạn lưu dữ liệu/clipboard khi mở bằng `file://`. Nếu sao chép tự động không được, ứng dụng mở hộp chứa nội dung để bạn sao chép thủ công. Dùng website GitHub Pages để có địa chỉ HTTPS ổn định; vẫn nên xuất JSON dự phòng.

## Đưa lên GitHub Pages

1. Trên GitHub, tạo repository **Public**, ví dụ `tft-tuy-duyen`.
2. Chọn **Add file → Upload files**, đưa các file **bên trong thư mục đã giải nén** lên gốc repository: `index.html`, `style.css`, `script.js`, `config.js`, `score-engine.js`, `cloud-client.js`, `live-admin.js`, `watch.html`, `watch.js`, `README.md`, `.nojekyll` nếu công cụ upload hiển thị file này. File `.nojekyll` chỉ để bỏ qua Jekyll; website vẫn dùng được nếu thiếu file đó.
3. Chọn **Commit changes**. Kiểm tra tab Code nhìn thấy `index.html` ngay ở cấp đầu tiên, không nằm trong một thư mục con.
4. Mở **Settings → Pages → Build and deployment**.
5. Ở **Source**, chọn **Deploy from a branch**; chọn branch **main** (hoặc branch chứa mã của bạn) và thư mục **/ (root)**, rồi **Save**.
6. Đợi tác vụ triển khai hoàn tất; lấy URL do GitHub hiển thị trong Settings → Pages. Với repository ví dụ, địa chỉ thường là `https://TEN-GITHUB.github.io/tft-tuy-duyen/`.
7. Để cập nhật, thay các file và commit vào branch đã chọn. GitHub Pages sẽ triển khai lại. Khi trình duyệt còn giữ bản cũ, dùng Ctrl+F5.

Các đường dẫn CSS/JS đều tương đối nên hoạt động cả với repository website ở thư mục con. Không cần GitHub Actions tùy chỉnh hoặc bước build.

Hướng dẫn nguồn: [GitHub Docs — Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Giải đấu

- Nhập **2–8 người**, mỗi người một dòng. Tên trùng (kể cả khác chữ hoa/thường) bị từ chối; tối đa 60 ký tự/tên.
- Đặt tên giải, ngưỡng Checkmate (mặc định 20), và điểm Top 1–8 (mặc định 8–1). Điểm phải là số nguyên 0–1000, không tăng từ Top 1 xuống Top 8.
- Hai chế độ: **Checkmate** hoặc **chỉ xếp hạng theo điểm**. Luật cố định khi tạo giải để kết quả nhất quán.
- Chọn thứ hạng riêng cho từng người. Nhấn lại để bỏ chọn, hoặc chọn một thứ hạng khác còn trống. Không được dùng trùng thứ hạng.
- Điểm chỉ thay đổi khi bấm **Chốt ván đấu**. Ván đang nhập tự lưu nhưng chưa tính điểm.
- Lobby ít hơn 8 người vẫn chọn thứ hạng 1–8 theo bảng điểm 8 người, tiện theo dõi một nhóm trong lobby có người ngoài.
- Bấm số điểm trong BXH để **đặt tổng điểm mới** và ghi lý do. Ứng dụng lưu phần chênh lệch thành một mục lịch sử, phù hợp điểm khởi đầu, cộng/trừ hoặc phạt điểm. Sửa ván cũ sẽ giữ nguyên phần điều chỉnh đã ghi, không cố định lại tổng điểm tại thời điểm cũ.
- **Sửa** tại tiêu đề ván trong lịch sử để cập nhật và tính lại. Lịch sử mở rộng theo số ván, không còn giới hạn hiển thị 6 ván. Giới hạn dữ liệu: tổng 2.000 ván và điều chỉnh/giải.
- **Hoàn tác** giữ tối đa 40 thao tác giải đấu trong phiên hiện tại, gồm chốt ván, sửa ván, chỉnh điểm, xóa lịch sử và tạo giải. Sau khi tải lại trang, dùng sửa ván/xóa mục cuối; lịch sử hoàn tác trong bộ nhớ không được giữ.
- **Trình chiếu** ẩn phần nhập để hiển thị BXH và lịch sử; nhấn Esc hoặc Thoát trình chiếu để trở lại.

### Checkmate được tính thế nào?

Ví dụ ngưỡng 20: người chơi có 17 điểm, lấy Top 1 và lên 25. Họ **chưa vô địch** ở ván đó, chỉ bắt đầu sẵn sàng Checkmate. Nếu giành Top 1 ở một ván sau khi đã đủ ngưỡng trước ván, họ vô địch.

Điều chỉnh điểm không tạo chiến thắng hồi tố; chỉ ảnh hưởng điều kiện trước các ván phía sau. Khi có nhà vô địch, ứng dụng dừng ghi thêm ván/điều chỉnh; vẫn cho sửa lịch sử hoặc hoàn tác. Một thay đổi tạo chiến thắng sớm hơn các dữ liệu phía sau sẽ bị từ chối: hãy xóa các mục phía sau trước.

Xếp hạng khi bằng điểm: số Top 1 → số Top 4 → thứ hạng trung bình thấp hơn. Nếu vẫn bằng nhau thì đồng hạng, thứ tự tên trong danh sách gốc chỉ dùng để trình bày ổn định. Nhà vô địch Checkmate được xác định bằng luật thắng, có thể khác người dẫn đầu tổng điểm.

## Chia team — tab riêng

- Nhập danh sách tên, **hoặc chỉ nhập X người** (2–200), tự tạo tên Người chơi 01, 02…
- Chọn **2, 3, 4 hoặc 5 team**. Số người phải bằng hoặc lớn hơn số team.
- Chia ngẫu nhiên, không lặp/thiếu người; số thành viên giữa các team chênh tối đa một.
- Team nhận người dư cũng được chọn ngẫu nhiên. Ví dụ 17 người / 5 team: kích thước 4, 4, 3, 3, 3 theo thứ tự ngẫu nhiên.
- Có thể chọn một đội trưởng ngẫu nhiên mỗi team (ký hiệu ♛), lấy danh sách từ giải đang chơi và sao chép kết quả.
- Mỗi lần chia là độc lập, nên có thể gặp lại cách chia cũ; không có quy tắc tránh đồng đội cũ. Chia cân bằng **số lượng**, không cân bằng trình độ/rank. Team là nhóm người chơi, không tự tạo lobby hoặc cộng điểm đội.
- Thay đổi cấu hình chưa thay đổi kết quả cũ cho đến khi bấm **Chia team ngẫu nhiên**.

## Dữ liệu và chia sẻ

- **Tự lưu** vào localStorage của trình duyệt: giải hiện tại, bản nháp ván kế tiếp, cấu hình/kết quả chia team. Không dùng tài khoản và không gửi điểm tới server.
- **Sao lưu JSON** chứa toàn bộ dữ liệu trên. **Khôi phục JSON** kiểm tra định dạng rồi hỏi trước khi thay thế. File tối đa 2 MB. Bản sửa ván lịch sử chưa bấm lưu không đưa vào backup.
- **CSV** chứa BXH, thứ hạng từng ván, tổng điều chỉnh, Top 1, Top 4 và trung bình; dùng UTF-8 BOM để hiển thị tiếng Việt trong bảng tính.
- **Sao chép BXH/team** dùng để gửi kết quả qua chat. Khi chưa kết nối Supabase, mỗi máy có dữ liệu riêng. Sau khi cấu hình, dùng nút Phát giải để tạo link chỉ xem và tự đồng bộ. Muốn chuyển giải cục bộ, gửi bản sao JSON để nhập trên máy khác.
- Chỉ một giải đang hoạt động. Xuất JSON trước khi tạo giải mới nếu muốn giữ nhiều giải.
- Dữ liệu của trang cũ không tự chuyển sang; bản gốc chỉ lưu trong biến JavaScript. Có thể nhập lại người chơi rồi đặt điểm hiện có.
- Nên chỉnh trên một tab. Nếu tab khác thay đổi dữ liệu, tự lưu tạm dừng ở tab cũ để tránh ghi đè; xuất JSON nếu cần giữ bản đang chỉnh rồi tải lại.

## Mã nguồn

| File | Vai trò |
| --- | --- |
| `index.html` | Giao diện tiếng Việt, điều hướng, biểu mẫu, hộp thoại |
| `style.css` | Màu sắc, bố cục desktop/mobile, chế độ trình chiếu/in |
| `script.js` | Event log tính điểm, Checkmate, kiểm tra dữ liệu, lưu/nhập/xuất, chia team |
| `.nojekyll` | Cho GitHub Pages phục vụ file tĩnh trực tiếp |

Không dùng `eval`, không chèn tên người chơi trực tiếp vào HTML chưa escape; kiểm tra JSON trước khi dùng và xử lý tên có thể thành công thức khi xuất CSV. Bốc thăm dùng Web Crypto và Fisher–Yates. Không có analytics hoặc tracker. Khi bật phần trực tiếp, ứng dụng gọi API Supabase của project bạn cấu hình.

Công cụ cộng đồng, không thuộc hoặc được bảo trợ bởi Riot Games.

## Kiểm tra mã cục bộ (tùy chọn)

Website không cần Node để chạy. Nếu muốn kiểm tra logic và đã có Node, chạy từ thư mục project:

```bash
node tests/test.cjs
```

Bộ kiểm tra gồm 59 trường hợp cho Checkmate, điều chỉnh điểm, dữ liệu không hợp lệ, hoàn tác, bản nháp khi sửa lịch sử, HTML/CSV escaping, chia team 2–200 người và tránh ghi đè dữ liệu từ tab cũ. Kiểm tra sử dụng logic thật và DOM mô phỏng; không thay thế kiểm thử trên trình duyệt thật.

Đã kiểm tra cú pháp JavaScript, ID/label HTML và cấu trúc CSS. Kiểm tra trực quan desktop/mobile chưa thực hiện được vì môi trường kiểm tra chặn trang cục bộ.

Phần trực tiếp bổ sung 14 kiểm tra client và 27 kiểm tra PostgreSQL; xem hướng dẫn live để chạy đủ 100 kiểm tra và hoàn tất thiết lập online.
