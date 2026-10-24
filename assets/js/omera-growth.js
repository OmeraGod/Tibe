/* Planning controls are assumptions, never platform observations or forecasts. */
(function(root){'use strict';
 const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(n);
 let growth=null;
 function render(value){
  growth=value;const section=$('growth-planner');if(!section)return;section.hidden=!value;if(!value)return;
  $('growth-daily-note').textContent='Mục tiêu: 10–20 đăng ký ròng/ngày. '+value.daily_measurement_note;
  $('growth-sample').textContent=value.sample_note;
  $('growth-examples').textContent=(value.observed_video_conversions||[]).map(v=>v.title+': '+fmt(v.subscribers_change)+' đăng ký / '+fmt(v.analytics_views)+' views Analytics = '+fmt(v.net_subscribers_per_1000_analytics_views)+'/1.000 · tuổi lúc đọc '+(typeof v.age_hours==='number'?fmt(v.age_hours)+' giờ':'chưa có')).join(' • ');
  $('growth-strategy').textContent=value.strategy;
  const future=value.announced_thresholds;
  $('growth-future-note').textContent='YouTube đã công bố từ 01/02/2027: '+fmt(future.subscribers)+' đăng ký và '+fmt(future.public_watch_hours_365d)+' giờ đủ điều kiện/365 ngày HOẶC '+fmt(future.valid_shorts_views_90d)+' Shorts đủ điều kiện/90 ngày cho người mới. Nguồn kiểm tra '+value.rules_checked_on+'. Không tự coi đạt ngưỡng là đã được duyệt.';
  calculate();
 }
 function calculate(){
  if(!growth)return;
  const target=Number($('growth-target').value),conversion=Number($('growth-conversion').value),days=Number($('growth-days').value),avd=Number($('growth-avd').value);
  const valid=[target,conversion,days,avd].every(n=>Number.isFinite(n)&&n>0)&&target<=1000&&conversion<=1000&&days<=365&&avd<=60;
  $('growth-validation').textContent=valid?'Các kết quả dưới đây là phép tính theo giả định, không phải số liệu thực hoặc ngày dự báo bật kiếm tiền.':'Nhập số dương hợp lệ: mục tiêu và đăng ký/1.000 tối đa1.000, số ngày tối đa365, xem trung bình tối đa60phút.';
  if(!valid){for(const id of ['growth-views','growth-hours','growth-long-views'])$(id).textContent='—';return;}
  const rules=$('growth-rules').value==='announced'?growth.announced_thresholds:growth.current_thresholds;
  const observed=growth.eligible_watch_hours_observed,known=typeof observed==='number'&&Number.isFinite(observed);
  const remaining=known?Math.max(0,rules.public_watch_hours_365d-observed):null;
  const hours=remaining===null?null:remaining/days;
  $('growth-views').textContent=fmt(Math.ceil(target*1000/conversion));
  $('growth-conversion-note').textContent=fmt(target)+' đăng ký ròng ÷ '+fmt(conversion)+' mỗi1.000views. Không phải tỷ lệ chuyển đổi đã ổn định.';
  $('growth-hours').textContent=hours===null?'Chưa có số giờ gốc':fmt(hours)+' giờ';
  $('growth-long-views').textContent=hours===null?'Chưa có số giờ gốc':fmt(Math.ceil(hours*60/avd));
  $('growth-watch-note').textContent=remaining===null?'Chưa đọc được giờ đủ điều kiện; không thay bằng0.':fmt(remaining)+' giờ còn thiếu ÷ '+fmt(days)+' ngày. Earn xử lý tới '+growth.eligibility_processed_through+'.';
  $('growth-rules-note').textContent='Ngưỡng đang tính: '+fmt(rules.subscribers)+' đăng ký và '+fmt(rules.public_watch_hours_365d)+' giờ công khai đủ điều kiện/365ngày HOẶC '+fmt(rules.valid_shorts_views_90d)+' Shorts đủ điều kiện/90ngày. Chỉ riêng nhánh Shorts tương đương khoảng '+fmt(Math.ceil(rules.valid_shorts_views_90d/90))+' lượt đủ điều kiện/ngày nếu phân bổ đều. Giờ trên Trang Shorts không cộng vào nhánh giờ công khai. Phép tính không mô phỏng giờ/lượt xem hết hạn khỏi cửa sổ365/90ngày.';
 }
 for(const id of ['growth-target','growth-conversion','growth-days','growth-avd','growth-rules'])$(id)?.addEventListener('input',calculate);
 root.OmeraGrowth={render};
})(window);
