"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onImageUpload?: (file: File) => Promise<string>;
}

const EMOJI_GROUPS = [
  { label: "Faces", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫠","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐"] },
  { label: "Gestures", emojis: ["👋","🤚","🖐️","✋","🖖","🫱","🫲","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🙏","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄"] },
  { label: "People", emojis: ["👶","🧒","👦","👧","🧑","👱","👨","🧔","👩","🧓","👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷","👮","🕵️","💂","🥷","👷","🫅","🤴","👸","👳","👲","🧕","🤵","👰","🤰","🫃","🤱","👼","🎅","🤶","🦸","🦹","🧙","🧚","🧛","🧜","🧝","🧞","🧟","🧌","💆","💇","🚶","🧍","🧎","🏃","💃","🕺","🕴️","👯","🧖","🧗","🤸","⛹️","🏋️","🚴","🚵","🤼","🤽","🤾","🤺","⛷️","🏂","🏌️","🏇","🏊","🤹","🧘","🛀","🛌"] },
  { label: "AI & Tech", emojis: ["🤖","👾","🎮","💻","🖥️","📱","⌨️","🖱️","🖨️","💽","💾","💿","📀","🔧","⚙️","🔩","🔗","⛓️","📡","🛰️","📊","📈","📉","🧮","🔬","🔭","📋","📌","📍","🗂️","📂","📁","📎","🖇️","📐","📏","✂️","🗃️","🗄️","🗑️","🔒","🔓","🔑","🗝️","🛠️","⚒️","🔨","⛏️","🪓","🔮","🧿","🧪","🧫","🧬","🦠","🔋","🔌","💡","🕯️","🪫","📺","📻","📷","📹","🎥","📽️","🎞️","📞","☎️","📟","📠"] },
  { label: "Prompt Lab", emojis: ["🧠","💡","⚡","🎯","🔥","✨","💫","🌟","⭐","🏆","💎","🛡️","⚔️","🗡️","🏹","🪄","🧙","📜","📖","📚","✏️","🖊️","🖋️","📝","💬","💭","🗨️","🗯️","📢","📣","🔔","🔕","🎵","🎶","🎤","🎧","🎼","🎹","🥁","🎷","🎺","🎸","🪕","🎻","🎬","🎭","🎨","🎪","🎰","🎲","🧩","🪆","♟️","🎳","🎯","🎱"] },
  { label: "Nature", emojis: ["🌍","🌎","🌏","🌐","🗺️","🧭","🏔️","⛰️","🌋","🗻","🏕️","🏖️","🏜️","🏝️","🏞️","🌅","🌄","🌠","🎇","🎆","🌇","🌆","🏙️","🌃","🌌","🌉","🌁","🌈","☀️","🌤️","⛅","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌪️","🌫️","🌬️","💨","💧","💦","🌊","🔥","🌸","🌺","🌻","🌹","🌷","🌼","🌱","🌿","☘️","🍀","🍁","🍂","🍃","🪴","🌵","🌴","🌳","🌲","🏡"] },
  { label: "Food", emojis: ["🍎","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🥑","🍆","🥦","🥬","🌽","🌶️","🫑","🥒","🥕","🧄","🧅","🥔","🍠","🫘","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🫓","🥪","🌮","🌯","🫔","🥙","🧆","🥗","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","☕","🫖","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🫗"] },
  { label: "Transport", emojis: ["🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️","🛵","🦽","🦼","🛺","🚲","🛴","🛹","🛼","🚏","🛣️","🛤️","🛞","⛽","🚨","🚥","🚦","🛑","🚧","⚓","🛟","⛵","🛶","🚤","🛳️","⛴️","🛥️","🚢","✈️","🛩️","🛫","🛬","🪂","💺","🚁","🚟","🚠","🚡","🛰️","🚀","🛸","🛶","⛺","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽","⛪","🕌","🛕","🕍","⛩️","🕋"] },
  { label: "Symbols", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","🛑","⛔","📛","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🚭","❗","❕","❓","❔","‼️","⁉️","🔅","🔆","〽️","⚠️","🚸","🔱","⚜️","🔰","♻️","✅","🈯","💹","❇️","✳️","❎","🌐","💠","Ⓜ️","🌀","💤","🏧","🚾","♿","🅿️","🛗","🈳","🈂️","🛂","🛃","🛄","🛅","🚹","🚺","🚻","🚼","🚮","🎦","📶","🈁","🔣","ℹ️","🔤","🔡","🔠","🆖","🆗","🆙","🆒","🆕","🆓","0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","🔢","#️⃣","*️⃣","⏏️","▶️","⏸️","⏹️","⏺️","⏭️","⏮️","⏩","⏪","⏫","⏬","◀️","🔼","🔽","➡️","⬅️","⬆️","⬇️","↗️","↘️","↙️","↖️","↕️","↔️","↩️","↪️","⤴️","⤵️","🔀","🔁","🔂","🔄","🔃","🎵","🎶","➕","➖","➗","✖️","🟰","♾️","💲","💱","™️","©️","®️","〰️","➰","➿","🔚","🔙","🔛","🔝","🔜","✔️","☑️","🔘","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤","🔺","🔻","🔸","🔹","🔶","🔷","🔳","🔲","▪️","▫️","◾","◽","◼️","◻️","🟥","🟧","🟨","🟩","🟦","🟪","⬛","⬜","🟫","🔈","🔇","🔉","🔊","🔔","🔕","📣","📢","🏁","🚩","🎌","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","🏴‍☠️"] },
  { label: "Flags", emojis: ["🇲🇳","🇺🇸","🇬🇧","🇯🇵","🇰🇷","🇨🇳","🇷🇺","🇩🇪","🇫🇷","🇮🇹","🇪🇸","🇧🇷","🇮🇳","🇦🇺","🇨🇦","🇹🇷","🇸🇬","🇹🇭","🇻🇳","🇵🇭","🇮🇩","🇲🇾","🇰🇿","🇺🇿","🇦🇪","🇸🇦","🇶🇦"] },
];

// Prompt Lab templates for AI community
const PROMPT_TEMPLATES = [
  { label: "🧠 System Prompt", html: `<div class="re-prompt-block re-prompt-system"><div class="re-prompt-label">SYSTEM PROMPT</div><div class="re-prompt-body" contenteditable="true">You are a helpful AI assistant that...</div></div><p><br></p>` },
  { label: "👤 User Prompt", html: `<div class="re-prompt-block re-prompt-user"><div class="re-prompt-label">USER</div><div class="re-prompt-body" contenteditable="true">Write your prompt here...</div></div><p><br></p>` },
  { label: "🤖 Assistant", html: `<div class="re-prompt-block re-prompt-assistant"><div class="re-prompt-label">ASSISTANT</div><div class="re-prompt-body" contenteditable="true">Expected output...</div></div><p><br></p>` },
  { label: "🔄 Full Conversation", html: `<div class="re-prompt-block re-prompt-system"><div class="re-prompt-label">SYSTEM PROMPT</div><div class="re-prompt-body" contenteditable="true">You are...</div></div><div class="re-prompt-block re-prompt-user"><div class="re-prompt-label">USER</div><div class="re-prompt-body" contenteditable="true">Input...</div></div><div class="re-prompt-block re-prompt-assistant"><div class="re-prompt-label">ASSISTANT</div><div class="re-prompt-body" contenteditable="true">Output...</div></div><p><br></p>` },
  { label: "📋 Prompt Template", html: `<div class="re-prompt-template"><div class="re-prompt-template-title" contenteditable="true">📋 Template Name</div><div class="re-prompt-template-body" contenteditable="true"><strong>Role:</strong> [Define the AI's role]<br><strong>Context:</strong> [Provide background]<br><strong>Task:</strong> [What to do]<br><strong>Format:</strong> [Expected output format]<br><strong>Constraints:</strong> [Any rules]</div></div><p><br></p>` },
  { label: "⚡ Quick Tip", html: `<div class="re-callout-tip">⚡ <strong>Pro Tip:</strong> Type your tip here...</div><p><br></p>` },
  { label: "🎯 Challenge", html: `<div class="re-challenge"><div class="re-challenge-header">🎯 CHALLENGE</div><div class="re-challenge-body" contenteditable="true"><strong>Goal:</strong> Describe the challenge<br><strong>Difficulty:</strong> ⭐⭐⭐<br><strong>XP Reward:</strong> +500 XP<br><strong>Hint:</strong> A helpful hint...</div></div><p><br></p>` },
];

const BLOCK_INSERTS = [
  { label: "📊 Table 2x3", html: `<table class="re-table"><thead><tr><th>Column 1</th><th>Column 2</th></tr></thead><tbody><tr><td>Data</td><td>Data</td></tr><tr><td>Data</td><td>Data</td></tr></tbody></table><p><br></p>` },
  { label: "🔲 Card Box", html: `<div class="re-card-box"><div class="re-card-title" contenteditable="true">📦 Card Title</div><div class="re-card-body" contenteditable="true">Card content goes here...</div></div><p><br></p>` },
  { label: "📌 Note", html: `<div class="re-callout-note">📌 <strong>Note:</strong> Important information here...</div><p><br></p>` },
  { label: "🔗 Link Card", html: `<div class="re-link-card"><span class="re-link-icon">🔗</span><div><div class="re-link-title" contenteditable="true">Link Title</div><div class="re-link-url" contenteditable="true">https://...</div></div></div><p><br></p>` },
  { label: "📐 Steps", html: `<div class="re-steps"><div class="re-step"><span class="re-step-num">1</span><div contenteditable="true">First step...</div></div><div class="re-step"><span class="re-step-num">2</span><div contenteditable="true">Second step...</div></div><div class="re-step"><span class="re-step-num">3</span><div contenteditable="true">Third step...</div></div></div><p><br></p>` },
];

export default function RichEditor({ value, onChange, placeholder = "Бичиж эхлэх...", onImageUpload }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiTab, setEmojiTab] = useState(0);
  const [showHeading, setShowHeading] = useState(false);
  const [showPromptLab, setShowPromptLab] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    if (editorRef.current && isInitialMount.current) {
      editorRef.current.innerHTML = value || "";
      isInitialMount.current = false;
      updateWordCount();
    }
  }, [value]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
      if (promptRef.current && !promptRef.current.contains(e.target as Node)) setShowPromptLab(false);
      if (blocksRef.current && !blocksRef.current.contains(e.target as Node)) setShowBlocks(false);
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setShowTextColor(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    triggerChange();
  }, []);

  const triggerChange = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      updateWordCount();
    }
  }, [onChange]);

  const updateWordCount = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || "";
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      exec(e.shiftKey ? "outdent" : "indent");
    }
    // Markdown shortcuts
    if (e.key === " " && editorRef.current) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        const text = node.textContent || "";
        const offset = range.startOffset;
        const beforeCursor = text.substring(0, offset);

        if (beforeCursor === "#") { e.preventDefault(); node.textContent = ""; exec("formatBlock", "h1"); }
        else if (beforeCursor === "##") { e.preventDefault(); node.textContent = ""; exec("formatBlock", "h2"); }
        else if (beforeCursor === "###") { e.preventDefault(); node.textContent = ""; exec("formatBlock", "h3"); }
        else if (beforeCursor === "-" || beforeCursor === "*") { e.preventDefault(); node.textContent = ""; exec("insertUnorderedList"); }
        else if (beforeCursor === ">") { e.preventDefault(); node.textContent = ""; exec("formatBlock", "blockquote"); }
        else if (beforeCursor === "---") { e.preventDefault(); node.textContent = ""; exec("insertHTML", `<hr class="re-hr" /><p><br></p>`); }
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/") && onImageUpload) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) handleImageFile(file);
        return;
      }
    }
  };

  const handleImageFile = async (file: File) => {
    if (!onImageUpload) return;
    setUploading(true);
    try {
      const url = await onImageUpload(file);
      exec("insertHTML", `<div class="re-img-wrap"><img src="${url}" alt="" class="re-img" /><br></div>`);
    } catch {
      alert("Зураг оруулахад алдаа гарлаа");
    } finally {
      setUploading(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    editorRef.current?.focus();
    document.execCommand("insertText", false, emoji);
    triggerChange();
  };

  const insertHeading = (level: number) => {
    exec("formatBlock", `h${level}`);
    setShowHeading(false);
  };

  const insertCodeBlock = () => {
    exec("insertHTML", `<pre class="re-code"><code>// code here</code></pre><p><br></p>`);
  };

  const insertDivider = () => {
    exec("insertHTML", `<hr class="re-hr" /><p><br></p>`);
  };

  const insertCallout = (type: "info" | "warning" | "success") => {
    const icons: Record<string, string> = { info: "💡", warning: "⚠️", success: "✅" };
    const colors: Record<string, string> = { info: "re-callout-info", warning: "re-callout-warning", success: "re-callout-success" };
    exec("insertHTML", `<div class="${colors[type]}">${icons[type]} Type here...</div><p><br></p>`);
  };

  const isActive = (cmd: string): boolean => {
    try { return document.queryCommandState(cmd); } catch { return false; }
  };

  const isEmpty = !value || value === "<br>" || value === "<p><br></p>" || value === "<div><br></div>";

  const TEXT_COLORS = [
    { label: "Default", color: "" },
    { label: "Gold", color: "#FFD300" },
    { label: "Red", color: "#ef4444" },
    { label: "Green", color: "#22c55e" },
    { label: "Blue", color: "#3b82f6" },
    { label: "Purple", color: "#a855f7" },
    { label: "Orange", color: "#f97316" },
    { label: "Pink", color: "#ec4899" },
    { label: "Cyan", color: "#06b6d4" },
    { label: "Dim", color: "#6a6a72" },
  ];

  // Filter emojis by search
  const filteredEmojis = emojiSearch
    ? EMOJI_GROUPS.flatMap(g => g.emojis).filter(() => true) // show all when searching (emoji don't have text labels to search)
    : EMOJI_GROUPS[emojiTab]?.emojis || [];

  return (
    <div className="rounded-[12px] border border-[#2a2a2e] bg-[#141416] overflow-hidden transition-all focus-within:border-[rgba(255,211,0,0.4)] focus-within:shadow-[0_0_0_1px_rgba(255,211,0,0.08)]">
      {/* ═══ Toolbar Row 1: Text formatting ═══ */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#2a2a2e] px-2 py-1.5 bg-[#1a1a1e]">
        <ToolBtn icon="B" active={isActive("bold")} onClick={() => exec("bold")} title="Bold (Ctrl+B)" className="font-bold" />
        <ToolBtn icon="I" active={isActive("italic")} onClick={() => exec("italic")} title="Italic (Ctrl+I)" className="italic" />
        <ToolBtn icon="U" active={isActive("underline")} onClick={() => exec("underline")} title="Underline" className="underline" />
        <ToolBtn icon="S" active={isActive("strikeThrough")} onClick={() => exec("strikeThrough")} title="Strikethrough" className="line-through" />

        <Sep />

        {/* Headings dropdown */}
        <div className="relative">
          <ToolBtn icon="H" onClick={() => { setShowHeading(!showHeading); setShowPromptLab(false); setShowBlocks(false); }} title="Heading" active={showHeading} />
          {showHeading && (
            <Dropdown>
              {[1,2,3].map(l => (
                <button key={l} onClick={() => insertHeading(l)} className="dropdown-item">
                  <span style={{ fontSize: `${20 - l * 2}px`, fontWeight: 700 }}>H{l} Heading</span>
                </button>
              ))}
              <button onClick={() => { exec("formatBlock", "p"); setShowHeading(false); }} className="dropdown-item text-[#6a6a72]">
                Normal text
              </button>
            </Dropdown>
          )}
        </div>

        {/* Text color */}
        <div className="relative" ref={colorRef}>
          <ToolBtn onClick={() => { setShowTextColor(!showTextColor); }} title="Text Color" active={showTextColor}>
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold leading-none">A</span>
              <div className="mt-0.5 h-[2px] w-3 rounded-full bg-[#FFD300]" />
            </div>
          </ToolBtn>
          {showTextColor && (
            <Dropdown>
              <div className="grid grid-cols-5 gap-1 p-1">
                {TEXT_COLORS.map(c => (
                  <button
                    key={c.label}
                    onClick={() => { if (c.color) exec("foreColor", c.color); else exec("removeFormat"); setShowTextColor(false); }}
                    title={c.label}
                    className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[14px] font-bold transition hover:bg-[rgba(255,255,255,0.08)]"
                    style={{ color: c.color || "#eeeee8" }}
                  >
                    A
                  </button>
                ))}
              </div>
            </Dropdown>
          )}
        </div>

        <Sep />

        {/* Lists */}
        <ToolBtn onClick={() => exec("insertUnorderedList")} title="Bullet List">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /><circle cx="1" cy="6" r="1" fill="currentColor" /><circle cx="1" cy="12" r="1" fill="currentColor" /><circle cx="1" cy="18" r="1" fill="currentColor" /></svg>
        </ToolBtn>
        <ToolBtn onClick={() => exec("insertOrderedList")} title="Numbered List">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
        </ToolBtn>

        <Sep />

        {/* Block elements */}
        <ToolBtn onClick={() => exec("formatBlock", "blockquote")} title="Quote">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z" /></svg>
        </ToolBtn>
        <ToolBtn onClick={insertCodeBlock} title="Code Block">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
        </ToolBtn>
        <ToolBtn onClick={insertDivider} title="Divider">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M3 12h18" /></svg>
        </ToolBtn>

        <Sep />

        {/* Callouts */}
        <ToolBtn onClick={() => insertCallout("info")} title="Info" icon="💡" />
        <ToolBtn onClick={() => insertCallout("warning")} title="Warning" icon="⚠️" />
        <ToolBtn onClick={() => insertCallout("success")} title="Success" icon="✅" />

        <Sep />

        {/* Link */}
        <ToolBtn onClick={() => { const url = prompt("URL:"); if (url) exec("createLink", url); }} title="Link">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
        </ToolBtn>

        {/* Image */}
        <ToolBtn onClick={() => fileInputRef.current?.click()} title="Image" disabled={uploading}>
          {uploading ? (
            <div className="h-3 w-3 animate-spin rounded-full border border-[#FFD300] border-t-transparent" />
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          )}
        </ToolBtn>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }} className="hidden" />

        <div className="flex-1" />

        <ToolBtn onClick={() => exec("removeFormat")} title="Clear Format">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </ToolBtn>
      </div>

      {/* ═══ Toolbar Row 2: Prompt Lab + Blocks + Emoji ═══ */}
      <div className="flex items-center gap-1 border-b border-[#2a2a2e] px-2 py-1 bg-[#161618]">
        {/* Prompt Lab */}
        <div className="relative" ref={promptRef}>
          <button
            onClick={() => { setShowPromptLab(!showPromptLab); setShowBlocks(false); setShowEmoji(false); }}
            className={`inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition ${
              showPromptLab ? "bg-[rgba(255,211,0,0.12)] text-[#FFD300]" : "text-[#6a6a72] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#eeeee8]"
            }`}
          >
            <span className="text-[13px]">🧠</span> Prompt Lab
          </button>
          {showPromptLab && (
            <div className="absolute left-0 top-full z-50 mt-1 w-[280px] rounded-[10px] border border-[#2a2a2e] bg-[#1a1a1e] p-1.5 shadow-2xl">
              <div className="mb-1 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-[#4a4a55]">Prompt Templates</div>
              {PROMPT_TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => { exec("insertHTML", t.html); setShowPromptLab(false); }} className="dropdown-item text-[12px]">
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Blocks */}
        <div className="relative" ref={blocksRef}>
          <button
            onClick={() => { setShowBlocks(!showBlocks); setShowPromptLab(false); setShowEmoji(false); }}
            className={`inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition ${
              showBlocks ? "bg-[rgba(255,211,0,0.12)] text-[#FFD300]" : "text-[#6a6a72] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#eeeee8]"
            }`}
          >
            <span className="text-[13px]">📦</span> Blocks
          </button>
          {showBlocks && (
            <div className="absolute left-0 top-full z-50 mt-1 w-[220px] rounded-[10px] border border-[#2a2a2e] bg-[#1a1a1e] p-1.5 shadow-2xl">
              <div className="mb-1 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-[#4a4a55]">Insert Block</div>
              {BLOCK_INSERTS.map((b, i) => (
                <button key={i} onClick={() => { exec("insertHTML", b.html); setShowBlocks(false); }} className="dropdown-item text-[12px]">
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Emoji */}
        <div className="relative" ref={emojiRef}>
          <button
            onClick={() => { setShowEmoji(!showEmoji); setShowPromptLab(false); setShowBlocks(false); }}
            className={`inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition ${
              showEmoji ? "bg-[rgba(255,211,0,0.12)] text-[#FFD300]" : "text-[#6a6a72] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#eeeee8]"
            }`}
          >
            <span className="text-[13px]">😀</span> Emoji
          </button>
          {showEmoji && (
            <div className="absolute left-0 top-full z-50 mt-1 w-[360px] rounded-[12px] border border-[#2a2a2e] bg-[#1a1a1e] shadow-2xl overflow-hidden">
              {/* Emoji search */}
              <div className="border-b border-[#2a2a2e] px-3 py-2">
                <input
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  placeholder="Search emoji..."
                  className="w-full rounded-[6px] border border-[#2a2a2e] bg-[#141416] px-3 py-1.5 text-[12px] text-[#eeeee8] placeholder-[#4a4a55] outline-none focus:border-[rgba(255,211,0,0.3)]"
                  autoFocus
                />
              </div>
              {/* Emoji tabs */}
              <div className="flex gap-0.5 overflow-x-auto border-b border-[#2a2a2e] px-2 py-1 scrollbar-hide">
                {EMOJI_GROUPS.map((g, i) => (
                  <button
                    key={g.label}
                    onClick={() => { setEmojiTab(i); setEmojiSearch(""); }}
                    className={`shrink-0 rounded-[4px] px-2 py-1 text-[10px] font-medium transition ${
                      emojiTab === i && !emojiSearch ? "bg-[rgba(255,211,0,0.1)] text-[#FFD300]" : "text-[#6a6a72] hover:text-[#eeeee8]"
                    }`}
                  >
                    {g.emojis[0]} {g.label}
                  </button>
                ))}
              </div>
              {/* Emoji grid */}
              <div className="max-h-[240px] overflow-y-auto p-2">
                <div className="flex flex-wrap gap-0.5">
                  {(emojiSearch ? EMOJI_GROUPS.flatMap(g => g.emojis) : filteredEmojis).map((e, i) => (
                    <button key={`${e}-${i}`} onClick={() => insertEmoji(e)} className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[18px] transition hover:bg-[rgba(255,211,0,0.1)] hover:scale-110 active:scale-90">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Word count */}
        <span className="text-[10px] tabular-nums text-[#3a3a48]">{wordCount} words</span>
      </div>

      {/* ═══ Editor Area ═══ */}
      <div className="relative min-h-[260px]">
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 px-6 py-5 text-[14px] leading-relaxed text-[#3a3a42]">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="rich-editor-content min-h-[260px] px-6 py-5 text-[15px] leading-[1.9] text-[rgba(238,238,232,0.85)] outline-none"
          onInput={triggerChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          spellCheck
        />
      </div>

      {/* ═══ Bottom bar: shortcuts hint ═══ */}
      <div className="flex items-center gap-3 border-t border-[#2a2a2e] px-3 py-1.5 bg-[#161618]">
        <span className="text-[9px] text-[#3a3a42]">Markdown: # H1 &nbsp; ## H2 &nbsp; ### H3 &nbsp; - list &nbsp; {">"} quote &nbsp; --- divider</span>
        <div className="flex-1" />
        <span className="text-[9px] text-[#3a3a42]">Paste images directly</span>
      </div>
    </div>
  );
}

function Sep() {
  return <div className="mx-0.5 h-4 w-px bg-[#2a2a2e]" />;
}

function Dropdown({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-0 top-full z-50 mt-1 rounded-[10px] border border-[#2a2a2e] bg-[#1a1a1e] p-1.5 shadow-2xl min-w-[150px]">
      {children}
    </div>
  );
}

function ToolBtn({ icon, children, active, onClick, title, className, disabled }: {
  icon?: string; children?: React.ReactNode; active?: boolean; onClick?: () => void; title?: string; className?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-[4px] text-[12px] transition ${
        active ? "bg-[rgba(255,211,0,0.15)] text-[#FFD300]" : "text-[#6a6a72] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#eeeee8]"
      } ${disabled ? "opacity-40 pointer-events-none" : ""} ${className || ""}`}
    >
      {children || icon}
    </button>
  );
}
