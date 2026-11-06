const { useState, useRef, useEffect } = React;

// 내 PC에서 열면 로컬 서버, 배포 후에는 같은 사이트의 /api/chat
const isLocal = ["127.0.0.1", "localhost"].includes(location.hostname);
const API_URL = isLocal ? "http://127.0.0.1:3001/api/chat" : "/api/chat";
const MAX_LENGTH = 2000;

/* ───────── 메인 화면: 통합관리시스템 (출퇴근 입력) ───────── */

// 출퇴근 기록은 실습용으로 이 브라우저(localStorage)에만 저장
const STORAGE_KEY = "attendance-records-v1";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const WORK_TYPES = ["사무실", "현장", "외근", "재택"];
const WEEK_TARGET_HOURS = 40;

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // 저장이 막힌 브라우저에서는 화면에서만 유지
  }
}

const pad = (n) => String(n).padStart(2, "0");

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtTime(iso) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDuration(ms) {
  if (!ms || ms < 0) return "-";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

function workedMs(rec, now) {
  if (!rec?.in) return 0;
  const end = rec.out ? new Date(rec.out) : now;
  return end - new Date(rec.in);
}

function fmtDate(d) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

const NOTICES = [
  { tag: "근태", title: "출퇴근은 근무 시작과 종료 시 바로 입력해 주세요" },
  { tag: "근태", title: "출퇴근 기록을 빠뜨렸다면 근태 정정 요청을 해 주세요" },
  { tag: "안내", title: "현장·외근·재택 근무 시 근무 형태를 선택하고 출근하세요" },
  { tag: "시스템", title: "통합관리시스템 실습 버전 안내" },
];

const QUICK_MENUS = [
  { icon: "🌴", label: "휴가 신청" },
  { icon: "📝", label: "근태 정정 요청" },
  { icon: "📂", label: "결재함" },
  { icon: "📅", label: "사내 일정" },
];

const NAV_MENUS = ["홈", "근태관리", "휴가", "결재", "공지사항"];

function MainPage({ onOpenChat }) {
  const [now, setNow] = useState(() => new Date());
  const [records, setRecords] = useState(loadRecords);
  const [workType, setWorkType] = useState(WORK_TYPES[0]);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  // 1초마다 시계 갱신
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  function update(next) {
    setRecords(next);
    saveRecords(next);
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  const todayKey = dateKey(now);
  const today = records[todayKey];
  const status = !today?.in ? "before" : !today.out ? "working" : "done";
  const STATUS_LABEL = { before: "출근 전", working: "근무 중", done: "퇴근 완료" };

  function checkIn() {
    if (today?.in) return;
    const time = new Date();
    update({ ...records, [todayKey]: { in: time.toISOString(), type: workType } });
    showToast(`출근 처리되었습니다 (${fmtTime(time.toISOString())})`);
  }

  function checkOut() {
    if (!today?.in || today.out) return;
    if (!window.confirm("퇴근 처리할까요?")) return;
    const time = new Date();
    update({ ...records, [todayKey]: { ...today, out: time.toISOString() } });
    showToast(`퇴근 처리되었습니다 (${fmtTime(time.toISOString())}) 수고하셨습니다!`);
  }

  function resetToday() {
    if (!today) return;
    if (!window.confirm("오늘 출퇴근 기록을 지울까요? (실습용 기능)")) return;
    const next = { ...records };
    delete next[todayKey];
    update(next);
    showToast("오늘 기록을 지웠습니다.");
  }

  function notReady(label) {
    showToast(`'${label}'은(는) 준비 중인 기능입니다.`);
  }

  // 이번 주 (월~금)
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = dateKey(d);
    return { d, key, rec: records[key], isToday: key === todayKey, isFuture: d > now && key !== todayKey };
  });
  const weekTotalMs = Object.entries(records)
    .filter(([key]) => {
      const d = keyToDate(key);
      return d >= monday && d <= now;
    })
    .reduce((sum, [, rec]) => sum + workedMs(rec, now), 0);
  const weekPercent = Math.min(100, (weekTotalMs / (WEEK_TARGET_HOURS * 3600000)) * 100);

  // 최근 기록 7일
  const recent = Object.keys(records).sort().reverse().slice(0, 7);

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "좋은 아침이에요" : hour < 18 ? "오늘도 힘내세요" : "오늘 하루 수고 많으셨어요";

  return (
    <div className="hm">
      <nav className="hm-nav">
        <div className="hm-nav-inner">
          <a href="#" className="hm-logo" onClick={(e) => e.preventDefault()}>
            <span className="hm-logo-mark">IMS</span>
            통합관리시스템
          </a>
          <div className="hm-menu">
            {NAV_MENUS.map((m, i) => (
              <button
                type="button"
                key={m}
                className={i === 0 ? "active" : ""}
                onClick={() => (i === 0 ? null : notReady(m))}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="hm-user">
            <span className="hm-user-avatar" aria-hidden="true">👤</span>
            <span className="hm-user-text">
              <strong>사용자</strong>
              <small>생산기술실</small>
            </span>
          </div>
        </div>
      </nav>

      <main className="hm-container">
        <section className="hm-welcome">
          <div>
            <p className="hm-date">{now.getFullYear()}년 {fmtDate(now)}</p>
            <h1>{greeting} 👋</h1>
          </div>
          <span className={`hm-status hm-status-${status}`}>{STATUS_LABEL[status]}</span>
        </section>

        <div className="hm-grid">
          {/* 출퇴근 입력 */}
          <section className="hm-card hm-punch">
            <h2 className="hm-card-title">출퇴근 입력</h2>
            <div className="hm-clock" aria-live="off">
              {pad(now.getHours())}:{pad(now.getMinutes())}
              <span className="hm-clock-sec">:{pad(now.getSeconds())}</span>
            </div>

            <div className="hm-times">
              <div>
                <span>출근</span>
                <strong>{fmtTime(today?.in)}</strong>
              </div>
              <div>
                <span>퇴근</span>
                <strong>{fmtTime(today?.out)}</strong>
              </div>
              <div>
                <span>근무시간</span>
                <strong>{today?.in ? fmtDuration(workedMs(today, now)) : "-"}</strong>
              </div>
            </div>

            <label className="hm-type">
              <span>근무 형태</span>
              <select
                value={today?.type || workType}
                onChange={(e) => setWorkType(e.target.value)}
                disabled={!!today?.in}
              >
                {WORK_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>

            <div className="hm-punch-btns">
              <button
                type="button"
                className="hm-btn hm-btn-in"
                onClick={checkIn}
                disabled={status !== "before"}
              >
                출근하기
              </button>
              <button
                type="button"
                className="hm-btn hm-btn-out"
                onClick={checkOut}
                disabled={status !== "working"}
              >
                퇴근하기
              </button>
            </div>

            {today && (
              <button type="button" className="hm-link" onClick={resetToday}>
                실습용: 오늘 기록 지우기
              </button>
            )}
          </section>

          {/* 이번 주 근무 */}
          <section className="hm-card">
            <h2 className="hm-card-title">이번 주 근무</h2>
            <div className="hm-week-total">
              <strong>{fmtDuration(weekTotalMs) === "-" ? "0분" : fmtDuration(weekTotalMs)}</strong>
              <span> / {WEEK_TARGET_HOURS}시간</span>
            </div>
            <div className="hm-progress" role="progressbar" aria-valuenow={Math.round(weekPercent)} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${weekPercent}%` }} />
            </div>
            <ul className="hm-week">
              {weekDays.map(({ d, key, rec, isToday, isFuture }) => (
                <li key={key} className={isToday ? "today" : ""}>
                  <span className="hm-week-day">
                    {WEEKDAYS[d.getDay()]}
                    <small>{d.getMonth() + 1}/{d.getDate()}</small>
                  </span>
                  <span className="hm-week-time">
                    {rec?.in
                      ? `${fmtTime(rec.in)} ~ ${rec.out ? fmtTime(rec.out) : isToday ? "근무 중" : "미입력"}`
                      : isFuture
                      ? ""
                      : "기록 없음"}
                  </span>
                  <span className="hm-week-dur">{rec?.in ? fmtDuration(workedMs(rec, now)) : ""}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 최근 출퇴근 기록 */}
          <section className="hm-card hm-wide">
            <h2 className="hm-card-title">최근 출퇴근 기록</h2>
            {recent.length === 0 ? (
              <p className="hm-empty">아직 기록이 없습니다. [출근하기]를 눌러 첫 기록을 남겨 보세요.</p>
            ) : (
              <div className="hm-table-wrap">
                <table className="hm-table">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>근무 형태</th>
                      <th>출근</th>
                      <th>퇴근</th>
                      <th>근무시간</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((key) => {
                      const rec = records[key];
                      const isToday = key === todayKey;
                      const state = rec.out ? "정상" : isToday ? "근무 중" : "퇴근 미입력";
                      const stateClass = rec.out ? "ok" : isToday ? "working" : "warn";
                      return (
                        <tr key={key}>
                          <td>{fmtDate(keyToDate(key))}</td>
                          <td>{rec.type || "-"}</td>
                          <td>{fmtTime(rec.in)}</td>
                          <td>{fmtTime(rec.out)}</td>
                          <td>{fmtDuration(workedMs(rec, now))}</td>
                          <td>
                            <span className={`hm-chip hm-chip-${stateClass}`}>{state}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 공지사항 */}
          <section className="hm-card">
            <h2 className="hm-card-title">공지사항</h2>
            <ul className="hm-notice">
              {NOTICES.map((n) => (
                <li key={n.title}>
                  <span className="hm-notice-tag">{n.tag}</span>
                  <span className="hm-notice-title">{n.title}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 바로가기 */}
          <section className="hm-card">
            <h2 className="hm-card-title">바로가기</h2>
            <div className="hm-quick">
              {QUICK_MENUS.map((q) => (
                <button type="button" key={q.label} onClick={() => notReady(q.label)}>
                  <span aria-hidden="true">{q.icon}</span>
                  {q.label}
                </button>
              ))}
              <button type="button" className="hm-quick-ai" onClick={onOpenChat}>
                <span aria-hidden="true">💬</span>
                AI 비서에게 묻기
              </button>
            </div>
          </section>
        </div>
      </main>

      <footer className="hm-footer">
        <p>신진엠텍 생산기술실 · 통합관리시스템 (실습용)</p>
        <p className="hm-footer-sub">
          출퇴근 기록은 실습용으로 이 브라우저에만 저장됩니다. 실제 근태 기록으로 사용되지 않습니다.
        </p>
      </footer>

      {toast && (
        <div className="hm-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ───────── 채팅 (레이어 팝업) ───────── */

function Avatar({ size = "sm" }) {
  return <div className={`avatar avatar-${size}`}>AI</div>;
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.15.26.35.27.57l.05 1.78a.8.8 0 0 0 1.12.71l1.99-.88a.8.8 0 0 1 .53-.04c.91.25 1.88.39 2.9.39 5.64 0 10-4.13 10-9.7S17.64 2 12 2Z"
      />
    </svg>
  );
}

function CloseIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function App() {
  // 메시지 role: "user" | "assistant" | "error"
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false); // 채팅창 열림 여부
  const [unread, setUnread] = useState(false); // 닫혀 있을 때 새 답변 표시
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;

  // 새 메시지가 생기거나 창을 열면 맨 아래로 스크롤
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  // 창을 열면 입력창에 커서, 새 답변 표시 지우기
  useEffect(() => {
    if (open) {
      setUnread(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  // Esc 키로 닫기
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 입력 내용에 맞춰 입력창 높이 자동 조절
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    // 오류 메시지는 대화 기록에서 빼고 서버로 보냄
    const history = next
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map(({ role, text }) => ({ role, text }));

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) {
        throw new Error(data.error || "답변을 가져오지 못했습니다.");
      }
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
    } catch (err) {
      const msg =
        err instanceof TypeError
          ? "서버에 연결할 수 없습니다. 서버가 켜져 있는지 확인하세요."
          : err.message;
      setMessages((prev) => [...prev, { role: "error", text: msg }]);
    } finally {
      setLoading(false);
      if (openRef.current) inputRef.current?.focus();
      else setUnread(true); // 닫아 둔 사이에 답변이 오면 아이콘에 표시
    }
  }

  function onKeyDown(e) {
    // Enter = 전송, Shift+Enter = 줄바꿈 (한글 조합 중에는 무시)
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    if (loading) return;
    setMessages([]);
    inputRef.current?.focus();
  }

  // 같은 쪽 메시지가 이어지면 말풍선을 묶어 보이게 함
  function sideOf(m) {
    return m?.role === "user" ? "me" : "them";
  }

  return (
    <>
    <MainPage onOpenChat={() => setOpen(true)} />

    <div
      className={`app chat-panel ${open ? "open" : ""}`}
      role="dialog"
      aria-label="생산기술실 AI 비서 채팅"
      aria-hidden={!open}
    >
      <header className="header">
        <div className="profile">
          <Avatar size="md" />
          <div className="profile-text">
            <h1>생산기술실 AI 비서</h1>
            <span className="status">
              <span className="dot" /> 활동 중
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="clear-btn"
            onClick={clearChat}
            disabled={loading || messages.length === 0}
          >
            대화 지우기
          </button>
          <button
            type="button"
            className="close-btn"
            onClick={() => setOpen(false)}
            aria-label="채팅 닫기"
          >
            <CloseIcon size={22} />
          </button>
        </div>
      </header>

      <main className="messages" ref={listRef}>
        {/* 대화 시작 전 프로필 카드 */}
        <section className="intro">
          <Avatar size="lg" />
          <h2>생산기술실 AI 비서</h2>
          <p>신진엠텍 생산기술실 · AI 비서</p>
          <p className="intro-sub">궁금한 것을 메시지로 보내 보세요.</p>
        </section>

        {messages.map((m, i) => {
          const side = sideOf(m);
          const prevSame = sideOf(messages[i - 1]) === side && i > 0;
          const nextSame =
            (i < messages.length - 1 && sideOf(messages[i + 1]) === side) ||
            (i === messages.length - 1 && loading && side === "them");
          // 상대 메시지 묶음의 마지막에만 프로필 표시
          const showAvatar = side === "them" && !nextSame;
          const classes = [
            "bubble",
            m.role,
            prevSame ? "joined-top" : "",
            nextSame ? "joined-bottom" : "",
          ].join(" ");

          return (
            <div
              key={i}
              className={`row ${side} ${prevSame ? "tight" : ""}`}
            >
              {side === "them" && (
                <div className="avatar-slot">{showAvatar && <Avatar />}</div>
              )}
              <div className={classes}>{m.text}</div>
            </div>
          );
        })}

        {loading && (
          <div className="row them">
            <div className="avatar-slot">
              <Avatar />
            </div>
            <div className="bubble assistant typing" aria-label="답변 작성 중">
              <span className="dots">
                <i /><i /><i />
              </span>
              답변 작성 중...
            </div>
          </div>
        )}
      </main>

      <footer className="composer">
        <div className="input-pill">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="메시지 보내기..."
            rows={1}
            maxLength={MAX_LENGTH}
          />
          <button
            type="button"
            className="send-btn"
            onClick={send}
            disabled={loading || !input.trim()}
          >
            보내기
          </button>
        </div>
        <p className="notice">
          실습용 챗봇입니다. 실제 회사 자료나 개인정보를 입력하지 마세요.
        </p>
      </footer>
    </div>

    {/* 오른쪽 아래 채팅 아이콘 */}
    <button
      type="button"
      className={`launcher ${open ? "open" : ""}`}
      onClick={() => setOpen((v) => !v)}
      aria-label={open ? "채팅 닫기" : "AI 비서 채팅 열기"}
      aria-expanded={open}
    >
      {open ? <CloseIcon size={26} /> : <ChatIcon />}
      {!open && unread && <span className="badge" aria-label="새 답변" />}
    </button>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
