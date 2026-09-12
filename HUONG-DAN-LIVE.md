# 🐳 Bảng điểm trực tiếp — Admin & người xem

Bản này đã có mã đăng nhập Admin, phát giải, link chỉ xem, tự cập nhật và phân quyền tại PostgreSQL. Để dùng online, bạn cần tạo/kết nối project Supabase và đưa bản website mới lên GitHub Pages. `config.js` hiện để trống có chủ ý: chưa có project hay tài khoản online nào được tạo thay bạn.

## Cách nhanh nếu làm cùng ChatGPT

Cài và kết nối plugin Supabase bằng tài khoản của bạn, rồi cho biết project muốn dùng. ChatGPT có thể giúp áp dụng file SQL và điền cấu hình công khai vào mã. Không gửi mật khẩu hoặc khóa bí mật trong chat. Nên dùng project riêng cho tool này.

Bạn cũng có thể tự làm các bước dưới đây.

## 1. Tạo project và cơ sở dữ liệu

1. Mở [Supabase Dashboard](https://supabase.com/dashboard) và đăng nhập.
2. Tạo một project mới cho tool TFT. Lưu mật khẩu database ở nơi riêng của bạn; mật khẩu này không đi vào website.
3. Trong project, mở **SQL Editor → New query**.
4. Mở file `supabase/setup.sql` trong gói tải về, sao chép toàn bộ vào SQL Editor rồi **Run**.
5. File tạo hai bảng `tft_rooms`, `tft_admins` và các hàm đọc/ghi. Có thể chạy lại file; nó không xóa các giải đã có.

Không bỏ RLS hoặc mở quyền ghi bảng cho `anon` để xử lý lỗi. File đã thiết lập quyền chính xác; lỗi đăng nhập/quyền cần xử lý theo các bước sau.

## 2. Tạo tài khoản Admin của bạn

1. Trong Supabase, mở **Authentication → Users**.
2. Dùng chức năng thêm/tạo người dùng, nhập email và mật khẩu bạn muốn dùng trên tool. Đảm bảo tài khoản đã được xác nhận email (có thể chọn xác nhận khi tạo trong Dashboard).
3. Quay lại SQL Editor, chạy đoạn sau, thay email mẫu bằng email tài khoản vừa tạo:

```sql
insert into public.tft_admins (user_id)
select id from auth.users
where lower(email) = lower('EMAIL-ADMIN-CUA-BAN')
on conflict do nothing;

select u.email, a.user_id
from public.tft_admins a
join auth.users u on u.id = a.user_id;
```

Kết quả phải hiển thị tài khoản của bạn. Chỉ những user có trong bảng này mới được quản lý giải. Tài khoản đăng ký khác không tự trở thành Admin. Mỗi Admin chỉ có quyền trên giải do chính họ tạo.

## 3. Điền cấu hình công khai

Lấy **Project URL** và **Publishable key** trong phần kết nối/API của project. Khóa Publishable thường bắt đầu bằng `sb_publishable_`. Legacy key loại `anon` cũng được hỗ trợ.

Mở `config.js` và sửa hai dòng:

```js
window.TFT_CONFIG = Object.freeze({
  supabaseUrl: 'https://PROJECT-CUA-BAN.supabase.co',
  publishableKey: 'sb_publishable_KHOA-CONG-KHAI-CUA-BAN',
  pollIntervalMs: 3000
});
```

Hai giá trị này được dùng ở trình duyệt và có thể đưa lên GitHub. **Không đưa Secret key, service_role, mật khẩu database, mật khẩu đăng nhập hoặc token Admin vào mã nguồn.** Quyền sửa nằm trong database, không dựa vào việc giấu public key.

Tham khảo: [Supabase — API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## 4. Cập nhật website GitHub Pages

Upload các file dưới đây ở **gốc repository**, thay bản cũ:

- `index.html`
- `style.css`
- `script.js`
- `config.js`
- `score-engine.js`
- `cloud-client.js`
- `live-admin.js`
- `watch.html`
- `watch.js`

Giữ cấu hình Pages: **Deploy from a branch → main → / (root)**. File `.nojekyll` trong gói có thể đưa lên cùng. README, hướng dẫn, SQL và thư mục tests không cần để website chạy, nhưng có thể giữ trong repository để quản lý source.

Đợi triển khai xong rồi Ctrl+F5. Phần **Chia sẻ giải đấu** phải hiện ô đăng nhập; không còn trạng thái “Cần cấu hình một lần”.

## 5. Tạo link cho anh em trong server

1. Mở website chính (`index.html`) và đăng nhập bằng tài khoản Admin vừa tạo.
2. Tạo giải, nhập tên người chơi, chọn luật; nếu đã có giải cục bộ thì giữ nguyên.
3. Bấm **Phát giải hiện tại**.
4. Bấm **Sao chép link**. Link có dạng `watch.html?room=...`; gửi link đó vào server.
5. Nhập kết quả và **Chốt ván đấu**. Trạng thái chuyển “Đang gửi điểm…” rồi “Đang chia sẻ” khi máy chủ đã nhận.
6. Người xem thấy điểm mới trong khoảng 3 giây cộng thời gian mạng, không cần tải lại trang. Họ không cần đăng nhập.

**Gửi link “chỉ xem”, không gửi mật khẩu Admin.** Trang này chỉ hiển thị điểm, lịch sử, tổng điều chỉnh và nhà vô địch; không có chức năng ghi điểm. Chỉnh HTML hoặc tự gọi API cũng không cho khách quyền ghi vào giải.

Mỗi giải có link riêng. Tạo giải mới và bấm phát sẽ tạo một link mới; các link giải cũ vẫn giữ kết quả cũ. Tab chia team vẫn dùng cục bộ, không đưa vào bảng điểm trực tiếp.

## 6. Tiếp tục giải ở lần sau hoặc máy khác

Phiên đăng nhập chỉ giữ trong bộ nhớ của tab. Khi tải lại/đóng tab, đăng nhập lại; ứng dụng không lưu mật khẩu hoặc refresh token trong localStorage.

Sau khi đăng nhập:

1. Trong **Giải đã lưu**, chọn đúng giải.
2. Bấm **Mở để quản lý**, xác nhận tải bản máy chủ.
3. Tiếp tục chốt/sửa điểm. Link người xem vẫn giữ nguyên.

Danh sách hiển thị 100 giải cập nhật gần nhất của bạn. Chốt ván/sửa lịch sử/điều chỉnh/hoàn tác ở giải đang kết nối đều tự gửi. Các ô thứ hạng chưa chốt chỉ lưu cục bộ, không gửi cho khán giả.

Nếu muốn phát một bản sao thành giải mới, tạo/nhập giải mới ở tool rồi bấm phát; đừng dùng nút “Phát” để tiếp tục một giải đã có link.

## 7. Tạm dừng, mất mạng, xung đột

- **Tạm dừng chia sẻ:** trang người xem sẽ ẩn bảng sau lần kiểm tra tiếp theo. Bấm **Mở lại chia sẻ** để dùng lại cùng link. Thao tác này không thu hồi các dữ liệu người xem đã nhận trước đó.
- **Đăng xuất:** ngừng quyền ghi của phiên, không tự tắt link đang phát. Muốn ngừng khán giả xem, hãy tạm dừng trước khi đăng xuất.
- **Mất mạng ở Admin:** bản sửa vẫn nằm cục bộ; trạng thái báo chưa đồng bộ. Dùng **Thử đồng bộ lại** sau khi có mạng. Đừng coi trạng thái lỗi là đã gửi điểm.
- **Mất mạng ở người xem:** giữ bảng gần nhất và báo có thể đã cũ; tự thử lại với khoảng cách tăng dần, tối đa 30 giây. Tab ẩn tạm ngừng kiểm tra, mở lại sẽ cập nhật.
- **Sửa cùng giải ở hai máy:** máy chủ chặn bản ghi có số phiên bản cũ. Xuất JSON để giữ bản đang sửa, rồi dùng **Thử đồng bộ lại** để tải bản máy chủ và xử lý xung đột. Không âm thầm ghi đè.
- **Yêu cầu gửi quá thời gian:** có thể máy chủ đã nhận nhưng trình duyệt chưa nhận phản hồi. Lần thử lại sẽ bị chặn nếu phiên bản đã đổi; tải bản máy chủ để xác nhận. Cơ chế này tránh cộng điểm hai lần.
- **Đóng tab khi còn dữ liệu đang gửi:** ứng dụng yêu cầu trình duyệt cảnh báo; một số trình duyệt có thể bỏ qua cảnh báo. Hãy chờ trạng thái đã đồng bộ hoặc xuất JSON trước.

## 8. Kiểm tra sau khi thiết lập

1. Admin tạo giải thử 2 người, phát link.
2. Mở link chỉ xem trong cửa sổ ẩn danh hoặc điện thoại khác.
3. Chốt một ván ở Admin; xem điểm có tự cập nhật ở máy kia.
4. Chỉnh điểm và sửa ván, kiểm tra lại tổng.
5. Tạm dừng → bảng ở máy kia được ẩn; mở lại → hiện lại.
6. Mở cùng giải ở hai tab Admin: sau khi một tab ghi, tab còn lại phải báo xung đột khi ghi.
7. Kiểm tra `config.js` chỉ có Project URL/Public key. Không thêm quyền bảng hoặc thay file SQL theo các hướng dẫn “mở tất cả quyền”.

## Cách hệ thống bảo vệ giải

- Supabase Auth xác thực email/mật khẩu, tự refresh phiên trong bộ nhớ khi cần.
- Hai bảng bật RLS và thu hồi toàn bộ quyền trực tiếp của `anon`/`authenticated`; không có policy trực tiếp, nên mặc định từ chối.
- Chỉ các hàm RPC được cấp quyền thực thi. Mọi hàm ghi kiểm tra `auth.uid()` có trong danh sách Admin và là chủ giải.
- Viewer chỉ có RPC `tft_watch` với ID giải; không có quyền liệt kê các giải, đọc bảng gốc hoặc ghi dữ liệu.
- RPC xem chỉ trả về thông tin giải cần hiển thị, không trả email/ID Admin, bản nháp hoặc lý do điều chỉnh riêng tư.
- URL chứa ID ngẫu nhiên. Ai có link đang phát đều có thể xem và chuyển tiếp; đây không phải cơ chế kiểm tra thành viên Discord.
- Máy chủ tăng `version` và so khớp phiên bản khi ghi. Một yêu cầu dùng phiên bản cũ bị từ chối.
- Tự cập nhật dùng HTTP polling mỗi 3 giây, không phải WebSocket. Nếu số người xem lớn, có thể tăng `pollIntervalMs`; hãy theo dõi mức sử dụng trên project Supabase.

Tham khảo thiết kế: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database Functions](https://supabase.com/docs/guides/database/functions), [Password Auth](https://supabase.com/docs/guides/auth/passwords).

## Kiểm tra mã đã chạy

- 59 kiểm tra logic giải/đội hình và DOM mô phỏng.
- 14 kiểm tra client đồng bộ với HTTP giả lập và trang spectator với DOM mô phỏng.
- 27 kiểm tra trên PostgreSQL qua PGlite: quyền thực thi, quyền bảng, Admin, chủ giải, phiên bản, ghi chú riêng tư và dừng/mở chia sẻ. File SQL cũng được thử chạy lại.

Tổng 100 trường hợp đạt trong môi trường phát triển. Chưa kết nối project Supabase thật, chưa kiểm tra Auth qua mạng thật và chưa xác minh giao diện trên trình duyệt thực tế. Cần thực hiện bước 8 sau khi bạn cấu hình project.

Chạy lại 73 kiểm tra không cần cài thư viện:

```bash
node tests/test.cjs
node tests/live.cjs
```

Để chạy cả kiểm tra database, dùng Node, cài dev dependency rồi chạy:

```bash
npm install
npm test
```

Website không cần `npm install` hoặc build để chạy. Dependency PGlite chỉ dùng cho kiểm tra SQL; không đưa `node_modules` lên GitHub Pages.
