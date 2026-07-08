# Cron 定时任务配置说明（供组长 A 集成时参考）

## 1. 创建每日简报任务（推荐早上 8:30 推送）
在集成电脑（A 的电脑）上执行：

```bash
openclaw cron create "30 8 * * *" \
  --name "Daily Knowledge Brief" \
  --session main \
  --system-event "$(cat cron/daily-briefing.prompt.md)" \
  --announce \
  --channel feishu \
  --to "请替换为飞书接收人ID或群组ID" \
  --tz "Asia/Shanghai"