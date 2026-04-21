**1. Tại sao không lưu binary file trong DB mà phải dùng storage?**
Không nên lưu binary file trực tiếp trong database vì database không tối ưu cho việc lưu và phân phối file lớn. Nếu lưu file dưới dạng binary hoặc base64 trong bảng dữ liệu, mỗi lần truy vấn danh sách task có thể kéo theo dữ liệu file, làm tăng dung lượng truyền tải, chậm truy vấn và khó mở rộng hệ thống. Storage được thiết kế riêng cho file, thường có CDN, URL truy cập, quản lý public/private tốt hơn, nên cách đúng là upload file lên storage rồi chỉ lưu URL và tên file trong DB. 

**2. `SUPABASE_URL` và `VITE_SUPABASE_URL` phải khai báo riêng biệt, giải thích cơ chế Vite.**
Hai biến này phải khai báo riêng vì backend và frontend đọc biến môi trường theo hai cơ chế khác nhau. Backend chạy trên Node.js nên đọc bằng `process.env`, có thể dùng tên biến bất kỳ. Frontend dùng Vite, và Vite chỉ đưa vào bundle những biến có tiền tố `VITE_`. Điều này giúp tránh vô tình đưa secret server lên mã frontend. Vì vậy cùng một giá trị URL nhưng phải khai báo thành hai biến riêng: một cho backend và một cho frontend. 

**3. Cú pháp `${SUPABASE_URL}` hoạt động local nhưng không hoạt động trên Vercel, tại sao?**
Khi chạy local, project có thể dùng cơ chế hỗ trợ mở rộng biến môi trường như `dotenv-expand`, nên giá trị kiểu `${SUPABASE_URL}` có thể được nội suy thành giá trị thật. Nhưng trên Vercel, environment variables không hỗ trợ kiểu interpolation đó trong cách bạn đang dùng, nên chuỗi `${SUPABASE_URL}` có thể bị giữ nguyên như text thường. Kết quả là app không nhận được URL thật. Vì vậy trên Vercel phải khai báo giá trị trực tiếp, không tham chiếu kiểu `${...}`. 

**4. Vite proxy `/api -> localhost:3001` chỉ chạy ở đâu? Production làm gì thay thế?**
Vite proxy chỉ hoạt động trong môi trường phát triển local, tức là khi chạy dev server bằng `npm run dev`. Lúc đó frontend gọi `/api/...` và Vite sẽ chuyển tiếp request sang `http://localhost:3001`. Khi build production, Vite dev server không còn tồn tại nên proxy cũng mất theo. Trong production, frontend phải gọi trực tiếp tới backend thật thông qua biến `VITE_API_BASE_URL`, ví dụ URL backend trên Vercel. 

**5. CI build pass nhưng app lỗi trên Vercel có thể xảy ra không? Cho ví dụ.**
Có. CI chỉ xác nhận rằng code có thể lint, test và build thành công trong môi trường CI, nhưng không đảm bảo cấu hình runtime trên Vercel là đúng. Ví dụ điển hình là CI vẫn pass nhưng trên Vercel thiếu `VITE_SUPABASE_ANON_KEY`, đặt sai `FRONTEND_URL`, sai `STORAGE_BUCKET`, hoặc để trống `VITE_API_BASE_URL`. Khi đó code vẫn build được nhưng runtime trên production sẽ lỗi. Đây là lý do “CI pass” không đồng nghĩa với “production chạy đúng”. 

**6. Nếu Supabase Storage down, tính năng nào vẫn chạy, tính năng nào fail?**
Nếu chỉ riêng Supabase Storage gặp sự cố, các chức năng liên quan đến file đính kèm sẽ fail, như upload file hoặc truy cập file đã upload. Tuy nhiên các chức năng không phụ thuộc storage vẫn có thể chạy nếu database vẫn hoạt động, ví dụ tạo task không kèm file, xem danh sách task, cập nhật trạng thái task, và realtime liên quan đến dữ liệu bảng `tasks`. Nói cách khác, storage hỏng không nhất thiết làm sập toàn bộ hệ thống, mà chỉ làm hỏng nhóm chức năng upload/file. 

**7. Tại sao `SUPABASE_SERVICE_ROLE_KEY` không được dùng ở frontend?**
Vì `SUPABASE_SERVICE_ROLE_KEY` là secret có quyền rất cao, có thể bypass toàn bộ Row Level Security và thao tác không giới hạn trên dữ liệu. Nếu đưa key này vào frontend thì bất kỳ ai mở DevTools, xem source hoặc chặn request cũng có thể lấy được key và dùng nó để đọc, ghi, xóa dữ liệu toàn hệ thống. Frontend chỉ được dùng `anon key`, còn `service_role key` chỉ được dùng ở backend, nơi người dùng không thể truy cập trực tiếp vào secret đó. 

**8. Thứ tự deploy backend → frontend → update CORS, giải thích tại sao không thể đảo thứ tự.**
Phải deploy backend trước vì frontend cần biết URL backend để cấu hình `VITE_API_BASE_URL`. Sau đó mới deploy frontend để lấy được URL frontend thật. Khi đã có URL frontend, backend mới có thể cập nhật `FRONTEND_URL` để cấu hình CORS cho đúng domain được phép gọi. Nếu đảo thứ tự, frontend sẽ không biết gọi backend nào, hoặc backend sẽ chưa biết domain frontend để cho phép request. Vì hai bên phụ thuộc URL của nhau nên thứ tự này là hợp lý nhất. 

**9. CORS error xảy ra ở client hay server? Server có nhận được request không?**
CORS error thể hiện ở phía client, cụ thể là trình duyệt chặn frontend đọc response khi policy không hợp lệ. Server vẫn có thể nhận request và thậm chí xử lý request đó, nhưng browser sẽ không cho JavaScript phía frontend sử dụng response nếu header CORS không đúng. Vì vậy đây là lỗi nhìn thấy ở client, nhưng nguyên nhân thường là do cấu hình server chưa cho phép origin tương ứng. 

**10. Có 3 frontend URL khác nhau cần gọi cùng 1 backend, cấu hình `FRONTEND_URL` như thế nào?**
Trong bài lab, `FRONTEND_URL` được xử lý theo kiểu tách chuỗi bằng dấu phẩy rồi đưa vào danh sách `allowedOrigins`. Vì vậy nếu có 3 frontend URL cùng được phép gọi backend, cần khai báo chúng trong cùng một biến, phân tách bằng dấu phẩy. Ví dụ:

```env
FRONTEND_URL=https://app-a.vercel.app,https://app-b.vercel.app,https://app-c.vercel.app
```

Sau đó backend sẽ đọc biến này, tách thành mảng các origin hợp lệ và cho phép các domain đó gọi API. 

