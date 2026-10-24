"""Planning arithmetic only; never writes platform metrics or predicts income."""
from __future__ import annotations
from datetime import date, datetime
import math

RULES_SOURCE = 'https://support.google.com/youtube/answer/72851?hl=vi'
FUTURE_SOURCE = 'https://support.google.com/youtube/answer/12843009'
SHORTS_SOURCE = 'https://support.google.com/youtube/answer/11914225?hl=vi'

def finite(value):
    return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)

def requirements_on(day: date):
    future = day >= date(2027,2,1)
    return {'subscribers':1000,'public_watch_hours_365d':8000 if future else 4000,
            'valid_shorts_views_90d':20000000 if future else 10000000,
            'effective_from':'2027-02-01' if future else '2026-10-22',
            'source':FUTURE_SOURCE if future else RULES_SOURCE}

def planning_math(*,target_subscribers_per_day=10,subscribers_per_1000_views=5,
                  remaining_watch_hours=4000,horizon_days=90,average_view_minutes=3):
    values=[target_subscribers_per_day,subscribers_per_1000_views,remaining_watch_hours,horizon_days,average_view_minutes]
    if not all(finite(v) for v in values) or target_subscribers_per_day<0 or subscribers_per_1000_views<=0 or remaining_watch_hours<0 or horizon_days<=0 or average_view_minutes<=0:
        raise ValueError('Positive, finite planning inputs required; remaining hours and target may be zero.')
    hours=remaining_watch_hours/horizon_days
    return {'scenario_views_per_day':math.ceil(target_subscribers_per_day*1000/subscribers_per_1000_views),
            'scenario_public_hours_per_day':hours,
            'scenario_long_views_per_day':math.ceil(hours*60/average_view_minutes),
            'is_forecast':False,'is_observed':False}

def growth_summary(snapshot, videos, today: date, channel_growth=None):
    thresholds=requirements_on(today)
    eligibility=snapshot.get('eligibility') or {}
    # Values remain as actually observed in Earn; this module never relabels
    # Content/Analytics hours as valid public watch hours.
    hours=eligibility.get('valid_public_watch_hours_365d')
    remaining=max(0,thresholds['public_watch_hours_365d']-hours) if finite(hours) and hours>=0 else None
    examples=[]
    for video in videos:
        if not video.get('original'):continue
        m=video.get('metrics') or {};views=m.get('analytics_views');subs=m.get('subscribers_change')
        if not finite(views) or views<=0 or not finite(subs):continue
        examples.append({'video_id':video['video_id'],'title':video['title'],
                         'analytics_views':views,'subscribers_change':subs,
                         'net_subscribers_per_1000_analytics_views':subs*1000/views,
                         'period':video.get('period'),'observed_at':video.get('analytics_observed_at'),
                         'age_hours':video.get('age_hours'),'source_url':video.get('source_url')})
    daily_average=None;net_7d=None;daily_note='Chưa có báo cáo đăng ký ròng theo từng ngày; không suy từ tổng người đăng ký hoặc số liệu từng tập.'
    g=channel_growth or {}
    try:
        start=date.fromisoformat(g['period_start']);end=date.fromisoformat(g['period_end'])
        if g.get('complete') is True and g.get('complete_days_count')==7 and (end-start).days==6 and end<today and finite(g.get('subscribers_net_change')) and g.get('source_url','').startswith('https://studio.youtube.com/channel/'):
            net_7d=g['subscribers_net_change'];daily_average=net_7d/7
            daily_note=f'Analytics toàn kênh {start} đến {end}: {net_7d:g} đăng ký ròng trong7ngày hoàn tất, trung bình {daily_average:.2f}/ngày. Đây là trung bình; không có nghĩa ngày nào cũng đạt.'
    except (KeyError,TypeError,ValueError):pass
    return {'rules_checked_on':'2026-10-22','current_thresholds':thresholds,
            'announced_thresholds':requirements_on(date(2027,2,1)),
            'official_sources':[RULES_SOURCE,FUTURE_SOURCE,SHORTS_SOURCE],
            'target_net_subscribers_per_day':[10,20],
            'actual_net_subscribers_per_day':daily_average,
            'actual_net_subscribers_last_completed_7_days':net_7d,
            'daily_measurement_note':daily_note,
            'eligible_watch_hours_observed':hours if finite(hours) else None,
            'eligibility_observed_at':eligibility.get('observed_at'),
            'eligibility_processed_through':eligibility.get('processed_through'),
            'remaining_qualified_public_hours':remaining,
            'observed_video_conversions':examples,
            'sample_note':'Các tập khác tuổi và mẫu nhỏ. Đây là tỷ số mô tả từ số liệu Analytics, không phải chuẩn ngành hoặc dự báo ổn định.',
            'example_scenarios':[{'target':n,'assumed_net_subscribers_per_1000_views':5,
                                 **planning_math(target_subscribers_per_day=n)} for n in [10,20]],
            'strategy':'Ưu tiên một video dài nguyên bản có ích, khoảng 5–8 phút mỗi tuần, để thử giữ chân và giờ công khai. Mỗi bài dài dùng một suất trong hạn mức, không ghép lặp Shorts. Shorts trả lời một câu hỏi riêng, CTA chỉ ở năm giây cuối. Nhịp đăng phụ thuộc chất lượng; chưa có dữ liệu để bảo đảm mục tiêu tăng trưởng.',
            'shorts_feed_hours_count_for_public_hours':False}
