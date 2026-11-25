{% load i18n %}{% blocktranslate trimmed with sender=sender_name job=job_title count=unread %}{{ sender }} đã gửi {{ count }} tin nhắn về vị trí {{ job }} mà bạn chưa đọc.{% endblocktranslate %}

{% translate "Vì quyền riêng tư, nội dung tin nhắn chỉ hiển thị khi bạn đăng nhập ProCV." %}

{% blocktranslate trimmed with url=action_url %}Mở cuộc trò chuyện: {{ url }}{% endblocktranslate %}
— {{ site_name }}
