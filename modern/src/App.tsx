import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  AudioLines,
  Check,
  CircleHelp,
  FileAudio,
  FolderPlus,
  Headphones,
  Music2,
  Pause,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { analyze, MAX_BYTES } from "./audio";
import { csvOf, restoreHistory, type Track } from "./model";

const historyKey = "ikabeat.history.v2";
const labels = {
  queued: "等待分析",
  working: "分析中",
  done: "已完成",
  error: "分析失败",
  cancelled: "已取消",
};
export default function App() {
  const [tracks, setTracks] = useState<Track[]>(() => {
    try {
      return restoreHistory(localStorage.getItem(historyKey));
    } catch {
      return [];
    }
  });
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [help, setHelp] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const files = useRef(new Map<string, File>());
  const active = useRef<{ id: string; controller: AbortController } | null>(
    null,
  );
  const mounted = useRef(true);
  const done = tracks.filter((t) => t.status === "done");
  const pending = tracks.filter(
    (t) => t.status === "queued" || t.status === "working",
  );
  const current = tracks.find((t) => t.id === selected) ?? done.at(-1);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(historyKey, JSON.stringify(done.slice(-100)));
    } catch {
      setNotice("本机存储空间不足，历史记录暂时无法保存。");
    }
  }, [tracks]);
  useEffect(() => {
    if (active.current) return;
    const next = tracks.find((t) => t.status === "queued");
    if (!next) return;
    const file = files.current.get(next.id);
    if (!file) return;
    const controller = new AbortController();
    active.current = { id: next.id, controller };
    const update = (patch: Partial<Track>) => {
      if (mounted.current)
        setTracks((ts) =>
          ts.map((t) => (t.id === next.id ? { ...t, ...patch } : t)),
        );
    };
    update({ status: "working", stage: "准备分析" });
    analyze(file, controller.signal, (stage) => update({ stage }))
      .then((result) => {
        if (controller.signal.aborted) return;
        update({ status: "done", result });
        if (mounted.current) setSelected(next.id);
      })
      .catch((error: Error) =>
        update({
          status: controller.signal.aborted ? "cancelled" : "error",
          error: error.message,
        }),
      )
      .finally(() => {
        files.current.delete(next.id);
        active.current = null;
        // A state update after clearing the ref starts the next queued task.
        if (mounted.current) setTracks((ts) => [...ts]);
      });
  }, [tracks]);
  function addFiles(incoming: File[]) {
    setNotice("");
    const accepted: Track[] = [];
    const rejected: string[] = [];
    for (const file of incoming) {
      if (!/\.(wav|mp3|flac|ogg|aif|aiff|m4a|aac)$/i.test(file.name)) {
        rejected.push(`${file.name}：不支持的文件类型`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejected.push(`${file.name}：超过 80 MB`);
        continue;
      }
      if (files.current.size >= 30) {
        rejected.push("每批最多 30 个文件");
        break;
      }
      const id = crypto.randomUUID();
      files.current.set(id, file);
      accepted.push({ id, name: file.name, size: file.size, status: "queued" });
    }
    setTracks((ts) => [...ts, ...accepted]);
    if (rejected.length) setNotice(rejected.join("；"));
  }
  function cancelAll() {
    active.current?.controller.abort();
    setTracks((ts) =>
      ts.map((t) =>
        t.status === "queued" ? { ...t, status: "cancelled" } : t,
      ),
    );
    for (const id of files.current.keys())
      if (id !== active.current?.id) files.current.delete(id);
  }
  async function exportResults() {
    const csv = new File([csvOf(done)], "ikaBeat-results.csv", {
      type: "text/csv;charset=utf-8",
    });
    try {
      if (navigator.canShare?.({ files: [csv] })) {
        await navigator.share({ files: [csv], title: "ikaBeat 分析结果" });
        return;
      }
      const url = URL.createObjectURL(csv);
      const link = document.createElement("a");
      link.href = url;
      link.download = csv.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setNotice(
        "已请求导出 CSV。若当前设备未保存文件，请使用系统分享功能或桌面版导出。",
      );
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        setNotice("导出失败，请重试。");
    }
  }
  const visible = tracks.filter(
    (t) =>
      (filter === "all" ||
        (filter === "done" ? t.status === "done" : t.status === "error")) &&
      t.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#">
          <img src="/assets/app-icon.png" alt="ikaBeat 原版图标" />
          <span>
            ikaBeat<small>MUSIC TEMPO STUDIO</small>
          </span>
        </a>
        <div className="nav-label">工作空间</div>
        <button
          className={filter === "all" ? "nav active" : "nav"}
          onClick={() => setFilter("all")}
        >
          <AudioLines size={19} />
          节拍分析<span>{tracks.length}</span>
        </button>
        <button
          className={filter === "done" ? "nav active" : "nav"}
          onClick={() => setFilter("done")}
        >
          <Check size={19} />
          已完成<span>{done.length}</span>
        </button>
        <button
          className={filter === "error" ? "nav active" : "nav"}
          onClick={() => setFilter("error")}
        >
          <CircleHelp size={19} />
          需要留意
          <span>{tracks.filter((t) => t.status === "error").length}</span>
        </button>
        <div className="sidebar-bottom">
          <div className="privacy">
            <ShieldCheck size={22} />
            <strong>
              音乐留在你的设备<small>离线分析 · 无需上传</small>
            </strong>
          </div>
          <button className="help-link" onClick={() => setHelp(true)}>
            <CircleHelp size={16} />
            使用说明与关于
          </button>
          <small className="version">ikaBeat 2.0 · 跨平台重构版</small>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            工作空间 <span>/</span> <b>节拍分析</b>
          </div>
          <span className="local-badge">
            <i />
            本地音频分析
          </span>
        </header>
        <div className="workspace">
          <section className="title-row">
            <div>
              <div className="eyebrow">FEEL THE RHYTHM</div>
              <h1>
                找到音乐的心跳<span>。</span>
              </h1>
              <p>把音乐交给 ika，让每一拍清晰可见。</p>
            </div>
            <button
              className="button secondary export"
              onClick={exportResults}
              disabled={!done.length}
            >
              <ArrowDownToLine size={17} />
              导出结果
            </button>
          </section>
          <section className="hero">
            <img src="/assets/ika.jpg" alt="原版 ika 应援横幅" />
            <div className="hero-shade" />
            <div className="hero-copy">
              <span className="pill">
                <Headphones size={13} />
                YOUR MUSIC, YOUR RHYTHM
              </span>
              <h2>
                好音乐，
                <br />
                都有自己的节奏。
              </h2>
              <p>熟悉的 ika，全新的节拍旅程。</p>
            </div>
            <div className="hero-tag">いっしょに、音楽を！</div>
          </section>
          <section
            className={`drop-zone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <div className="upload-icon">
              <Upload size={26} />
            </div>
            <div className="drop-copy">
              <h3>将音乐拖到这里，开始探索</h3>
              <p>
                或选择音频文件 · 每批最多 30 首 · 单文件最大 80 MB / 10 分钟
              </p>
              <div className="formats">
                WAV <span>MP3</span> FLAC <span>OGG</span> AIFF <span>M4A</span>
              </div>
            </div>
            <button
              className="button primary"
              onClick={() => input.current?.click()}
            >
              <FolderPlus size={18} />
              选择音乐
            </button>
            <input
              ref={input}
              type="file"
              multiple
              accept=".wav,.mp3,.flac,.ogg,.aif,.aiff,.m4a,.aac"
              aria-label="选择音频文件"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </section>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button aria-label="关闭提示" onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <div className="content-grid">
            <section className="library panel">
              <div className="panel-heading">
                <h3>
                  音乐列表 <span>{tracks.length}</span>
                </h3>
                <div className="list-actions">
                  {pending.length > 0 && (
                    <button onClick={cancelAll}>
                      <Pause size={15} />
                      取消队列
                    </button>
                  )}
                  <button
                    aria-label="清空已结束的记录"
                    title="清空已结束的记录"
                    disabled={
                      !tracks.some(
                        (t) => !["working", "queued"].includes(t.status),
                      )
                    }
                    onClick={() => {
                      setTracks((ts) =>
                        ts.filter(
                          (t) =>
                            t.status === "working" || t.status === "queued",
                        ),
                      );
                      setSelected(undefined);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="list-toolbar">
                <div className="tabs">
                  {[
                    ["all", "全部"],
                    ["done", "已完成"],
                    ["error", "失败"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={filter === value ? "selected" : ""}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索音乐"
                    aria-label="搜索音乐"
                  />
                </label>
              </div>
              <div className="table-header">
                <span>音乐文件</span>
                <span>状态</span>
                <span>BPM</span>
              </div>
              <div className="track-list">
                {visible.length ? (
                  visible.map((t) => (
                    <button
                      key={t.id}
                      className={`track ${current?.id === t.id ? "chosen" : ""}`}
                      onClick={() => setSelected(t.id)}
                    >
                      <span className="track-name">
                        <span className="file-icon">
                          <FileAudio size={20} />
                        </span>
                        <span>
                          <strong>{t.name}</strong>
                          <small>
                            {t.error ??
                              `${(t.size / 1024 / 1024).toFixed(1)} MB${t.result ? ` · ${Math.floor(t.result.duration / 60)}:${String(Math.floor(t.result.duration % 60)).padStart(2, "0")}` : ""}`}
                          </small>
                        </span>
                      </span>
                      <span className={`status ${t.status}`}>
                        {t.status === "working" && <i className="spinner" />}
                        {t.status === "working" ? t.stage : labels[t.status]}
                      </span>
                      <span className="bpm">
                        {t.result?.bpm.toFixed(2) ?? "—"}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="empty">
                    <Music2 size={32} />
                    <strong>
                      {tracks.length
                        ? "没有匹配的音乐"
                        : "下一首心动的音乐，是什么？"}
                    </strong>
                    <p>
                      {tracks.length
                        ? "试试其他名称或筛选条件。"
                        : "添加音频，即可查看 BPM 和节拍信息。"}
                    </p>
                  </div>
                )}
              </div>
              <div className="list-footer">
                <span>
                  {done.length} 首已完成
                  {pending.length ? ` · ${pending.length} 首待完成` : ""}
                </span>
                <span>
                  <ShieldCheck size={13} />
                  仅保存分析结果
                </span>
              </div>
            </section>
            <section className="detail panel">
              <div className="panel-heading">
                <h3>节拍详情</h3>
                <Activity size={17} />
              </div>
              <div className="bpm-display">
                <span>TEMPO</span>
                <strong>
                  {current?.result?.bpm.toFixed(2) ?? "—"}
                  <small>BPM</small>
                </strong>
                <p>
                  {current?.result
                    ? current.name
                    : "选择一首音乐，听见它的节奏"}
                </p>
              </div>
              <div className="waveform" aria-label="音频峰值波形">
                {(
                  current?.result?.waveform ??
                  Array.from({ length: 70 }, () => 0.03)
                ).map((n, i) => (
                  <i key={i} style={{ height: `${Math.max(4, n * 76)}px` }} />
                ))}
              </div>
              <div className="detail-row">
                <span>算法置信度（原始值）</span>
                <b>{current?.result?.confidence.toFixed(2) ?? "—"}</b>
              </div>
              <div className="detail-row">
                <span>检测到的节拍</span>
                <b>{current?.result?.beats?.length ?? "—"}</b>
              </div>
              <div className="detail-note">
                <img src="/assets/icon.jpg" alt="原版 ika 角色图片" />
                <p>
                  节拍有时会有双倍或半速解读。
                  <br />
                  让耳朵做最后的判断。
                </p>
              </div>
            </section>
          </div>
          <footer>
            <a href="https://github.com/Yukinsnow" target="_blank" rel="noopener noreferrer">Github@Yukinsnow</a>
            <span>Powered by Essentia · 原版 ika 素材保留</span>
          </footer>
        </div>
      </main>
      {help && (
        <div className="modal-overlay" onClick={() => setHelp(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="使用说明"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              autoFocus
              aria-label="关闭使用说明"
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <h2>你好，我是 ikaBeat。</h2>
            <p>作者：<a href="https://github.com/Yukinsnow" target="_blank" rel="noopener noreferrer">Github@Yukinsnow</a></p>
            <p>
              选择或拖入音频，应用会在本地解码，使用 Essentia
              RhythmExtractor2013
              分析节拍。分析结果保存在当前设备，原始音频不会被保存或上传。
            </p>
            <p>
              WAV / MP3 是优先验证格式。FLAC、OGG、AIFF、AAC、M4A
              的解码能力取决于系统。文件最长 10 分钟、最大 80
              MB；低内存设备建议使用较短片段。
            </p>
            <p>
              置信度是算法原始数值，并非百分比。取消会终止分析线程；系统解码阶段会在解码结束后取消。
            </p>
            <p>
              源码沿用原项目 GPLv3；Essentia.js 附带 AGPLv3
              许可，详见源码中的第三方说明。角色图片沿用原仓库，权利归原权利人。
            </p>
            <button className="button primary" onClick={() => setHelp(false)}>
              开始探索
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
