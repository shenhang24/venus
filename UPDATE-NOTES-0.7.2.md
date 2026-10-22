# Venus 0.7.2 — 2026-10-22 (Australia/Sydney)

## 今天追加更新 / Additional changes today

- 四个网络统一公转速度规则：同一宿主、同一层轨道中的行星角速度相同，不同轨道采用各自的速度，保持异步公转。
- 卫星与子卫星也按各自宿主和本地轨道分层应用规则，不把整个星系锁成同一速度。
- 移除按单个行星身份随机分配速度的规则，同轨节点不再因为速度差持续追赶；已有轨道半径、节点身份及累计公转角度保持。
- 原有动态换轨仍平滑过渡，隐藏动画暂停机制和有限潮汐影响保持。

All four networks now assign equal angular velocity to bodies sharing a host and orbital ring. Different rings have different periods; separate hosts retain deterministic asynchronous timing. The same rule applies to satellite and nested satellite rings. Accumulated orbital angles and individual clocks remain continuous across metadata updates. Per-planet speed jitter and catch-up yielding are replaced by ring-level speeds; layout, clearance and bounded tidal perturbations remain in place. A moving ring transition can still alter apparent screen speed temporarily; equal speed refers to revolution angle relative to the host, not equal pixels travelled per second.

## 同日已上传内容 / Earlier today

[0.7.1](UPDATE-NOTES-0.7.1.md) added recurring tags as automatic project groups at three/five independent Markdown sources, backdrop dialog dismissal and right-click back navigation. Those changes remain included.

## 验证及隐私 / Validation and privacy

Synthetic tests cover all four network kinds, equal speeds within rings, distinct speeds between rings, nested satellites, continuous clock progress across metadata updates and retained clearances. Build and full regression results are recorded in docs/RELEASE-REVIEW.md. No private source content, classification output, logs, account configuration or credentials are included. The private backend and ongoing analysis are not restarted by this change.
