(() => {
  "use strict";

  const $ = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => [...p.querySelectorAll(s)];
  const ids = [
    "contentInput","titleText","subtitleText","titleAlign","titleSize","subtitleSize","titleGap",
    "footerText","footerAlign","footerSize","footerGap","fontFamily","fontSize","letterSpacing",
    "lineHeight","paragraphGap","scaleX","imageWidth","textColor","secondaryColor","accentA","accentB",
    "highlightA","highlightB","autoQuotes","autoParen","textShadow","leftName","rightName","chatBg",
    "leftBubble","rightBubble","leftBubbleText","rightBubbleText","bubbleFontSize","bubbleLineHeight",
    "bubblePadding","bubbleGap","nameGap","bubbleWidth","canvasWidth","paddingX","paddingY","verticalAlign",
    "bgColor1","bgColor2","gradientAngle","overlayColor","overlayOpacity","bgBlur","borderWidth","borderColor",
    "borderRadius","exportScale","exportFormat","fileName"
  ];
  const E = Object.fromEntries(ids.map(id => [id, $("#"+id)]));
  const canvas = $("#canvas"), content = $("#previewContent"), stage = $("#stage");
  const defaultContent = `그는 잠깐 시선을 내렸다.

“오늘은 조금 늦었네.”

> 그러게. 기다렸어?
< 조금.

|a 그래도 결국, 돌아오는 사람은 정해져 있었다.

---

창밖으로 빛이 번졌다.`;
  E.contentInput.value = defaultContent;

  const state = {
    fontWeight: "500", align: "left", wrapMode: "keep-all", bubbleStyle: "simple",
    ratio: "auto", columns: 1, bgMode: "solid", bgImage: "", guides: true, zoom: 100,
    inlineImages: {}, customFontName: ""
  };

  const settingKeys = () => ({
    fields: Object.fromEntries(ids.filter(id => !["contentInput","fileName"].includes(id)).map(id => {
      const el = E[id];
      return [id, el.type === "checkbox" ? el.checked : el.value];
    })),
    state: {
      fontWeight:state.fontWeight, align:state.align, wrapMode:state.wrapMode, bubbleStyle:state.bubbleStyle,
      ratio:state.ratio, columns:state.columns, bgMode:state.bgMode
    }
  });

  function applySettingsObject(obj){
    if(!obj || !obj.fields) throw new Error("invalid");
    for(const [id,val] of Object.entries(obj.fields)){
      if(!E[id]) continue;
      if(E[id].type === "checkbox") E[id].checked = !!val; else E[id].value = val;
    }
    if(obj.state) Object.assign(state, obj.state);
    syncSegmented();
    render();
  }

  function syncSegmented(){
    $$("#weightButtons button").forEach(b=>b.classList.toggle("active",b.dataset.weight===String(state.fontWeight)));
    $$("#alignButtons button").forEach(b=>b.classList.toggle("active",b.dataset.align===state.align));
    $$("#wrapButtons button").forEach(b=>b.classList.toggle("active",b.dataset.wrapmode===state.wrapMode));
    $$("#bubbleStyleButtons button").forEach(b=>b.classList.toggle("active",b.dataset.bubblestyle===state.bubbleStyle));
    $$("#ratioButtons button").forEach(b=>b.classList.toggle("active",b.dataset.ratio===state.ratio));
    $$("#columnButtons button").forEach(b=>b.classList.toggle("active",Number(b.dataset.columns)===Number(state.columns)));
    $$("#backgroundButtons button").forEach(b=>b.classList.toggle("active",b.dataset.bg===state.bgMode));
  }

  function esc(s){ return s.replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

  function inlineMarkup(raw){
    // Protect supported tags while escaping everything else.
    const tokens = [];
    raw = raw.replace(/<\/?(?:b|i|c|ha|hb|q)>/gi, m => {
      const n = tokens.push(m.toLowerCase()) - 1;
      return `@@TAG${n}@@`;
    });
    let s = esc(raw);
    s = s.replace(/@@TAG(\d+)@@/g, (_,n)=>tokens[Number(n)] || "");
    if(E.autoQuotes.checked){
      s = s.replace(/([“"][^”"\n]+[”"])/g, '<span class="tag-c">$1</span>');
    }
    if(E.autoParen.checked){
      s = s.replace(/(\([^()\n]+\))/g, '<span class="auto-paren">$1</span>');
    }
    return s;
  }

  function makeP(txt){
    const div = document.createElement("div");
    div.className = "p";
    div.innerHTML = inlineMarkup(txt);
    return div;
  }

  function parsePage(raw){
    const frag = document.createDocumentFragment();
    const lines = raw.replace(/\r\n/g,"\n").split("\n");
    let paragraph = [], accentGroup = null, chat = null;

    const flushParagraph = () => {
      if(!paragraph.length) return;
      frag.appendChild(makeP(paragraph.join("\n")));
      paragraph = [];
    };
    const flushAccent = () => {
      if(accentGroup){ frag.appendChild(accentGroup); accentGroup = null; }
    };
    const flushChat = () => {
      if(chat){ frag.appendChild(chat); chat = null; }
    };
    const hardFlush = () => { flushParagraph(); flushAccent(); flushChat(); };

    for(const line of lines){
      if(line === "---"){
        hardFlush(); const hr=document.createElement("hr"); hr.className="divider"; frag.appendChild(hr); continue;
      }
      if(line === "==="){
        hardFlush(); const br=document.createElement("div"); br.className="page-break"; frag.appendChild(br); continue;
      }
      const img = line.match(/^\[\[image:([^\]]+)\]\]$/);
      if(img){
        hardFlush();
        const src=state.inlineImages[img[1]];
        if(src){ const im=document.createElement("img"); im.className="inline-photo"; im.src=src; frag.appendChild(im); }
        continue;
      }
      const accent = line.match(/^\|([ab])\s?(.*)$/);
      if(accent){
        flushParagraph(); flushChat();
        if(!accentGroup || accentGroup.dataset.type!==accent[1]){
          flushAccent();
          accentGroup=document.createElement("div");
          accentGroup.className="line-accent";
          accentGroup.dataset.type=accent[1];
          accentGroup.style.setProperty("--line-color", accent[1]==="a" ? E.accentA.value : E.accentB.value);
        }
        accentGroup.appendChild(makeP(accent[2])); continue;
      }
      const bubble = line.match(/^([<>])\s(.*)$/);
      if(bubble){
        flushParagraph(); flushAccent();
        if(!chat){ chat=document.createElement("div"); chat.className="chat-block"; }
        const side=bubble[1]===">"?"left":"right";
        const row=document.createElement("div"); row.className=`bubble-row ${side}`;
        const name = side==="left" ? E.leftName.value : E.rightName.value;
        if(name){ const nm=document.createElement("div"); nm.className="bubble-name"; nm.textContent=name; row.appendChild(nm); }
        const bub=document.createElement("div"); bub.className=`bubble ${state.bubbleStyle}`; bub.innerHTML=inlineMarkup(bubble[2]); row.appendChild(bub); chat.appendChild(row); continue;
      }
      if(line.trim()===""){
        hardFlush(); continue;
      }
      flushAccent(); flushChat(); paragraph.push(line);
    }
    hardFlush();
    return frag;
  }

  function currentCanvasHeight(width){
    if(state.ratio==="auto") return null;
    const [w,h]=state.ratio.split("/").map(Number);
    return Math.round(width*h/w);
  }

  function render(){
    // value labels
    const units = {
      titleSize:"px",subtitleSize:"px",titleGap:"px",footerSize:"px",footerGap:"px",
      fontSize:"px",letterSpacing:"px",lineHeight:"px",paragraphGap:"px",scaleX:"%",
      imageWidth:"%",bubbleFontSize:"px",bubbleLineHeight:"px",bubblePadding:"px",bubbleGap:"px",
      nameGap:"px",bubbleWidth:"%",canvasWidth:"px",paddingX:"px",paddingY:"px",
      gradientAngle:"°",overlayOpacity:"%",bgBlur:"px",borderWidth:"px",borderRadius:"px"
    };
    $$("[data-for]").forEach(v=>{ const id=v.dataset.for; v.textContent=(E[id]?.value ?? "")+(units[id]||""); });

    const width=Number(E.canvasWidth.value);
    canvas.style.width=width+"px";
    const fixedH=currentCanvasHeight(width);
    canvas.style.height=fixedH ? fixedH+"px" : "auto";
    canvas.style.minHeight=fixedH ? fixedH+"px" : "300px";
    canvas.style.border=`${E.borderWidth.value}px solid ${E.borderColor.value}`;
    canvas.style.borderRadius=E.borderRadius.value+"px";
    canvas.style.color=E.textColor.value;

    $(".canvas-inner").style.padding=`${E.paddingY.value}px ${E.paddingX.value}px`;
    $(".canvas-inner").style.justifyContent=E.verticalAlign.value==="center"?"center":E.verticalAlign.value==="bottom"?"flex-end":"flex-start";

    $("#previewTitle").textContent=E.titleText.value;
    $("#previewSubtitle").textContent=E.subtitleText.value;
    $("#previewFooter").textContent=E.footerText.value;
    $("#titleBlock").style.display=(E.titleText.value||E.subtitleText.value)?"block":"none";
    $("#titleBlock").style.textAlign=E.titleAlign.value;
    $("#previewTitle").style.fontSize=E.titleSize.value+"px";
    $("#previewSubtitle").style.fontSize=E.subtitleSize.value+"px";
    $("#titleBlock").style.marginBottom=E.titleGap.value+"px";
    $("#previewFooter").style.textAlign=E.footerAlign.value;
    $("#previewFooter").style.fontSize=E.footerSize.value+"px";
    $("#previewFooter").style.marginTop=E.footerGap.value+"px";
    $("#previewFooter").style.display=E.footerText.value?"block":"none";

    const family=state.customFontName?`'${state.customFontName}', ${E.fontFamily.value}`:E.fontFamily.value;
    $(".canvas-inner").style.fontFamily=family;
    content.style.fontWeight=state.fontWeight;
    content.style.textAlign=state.align;
    content.style.wordBreak=state.wrapMode;
    content.style.fontSize=E.fontSize.value+"px";
    content.style.lineHeight=E.lineHeight.value+"px";
    content.style.letterSpacing=E.letterSpacing.value+"px";
    content.style.setProperty("--secondary",E.secondaryColor.value);
    content.style.setProperty("--highlight-a",E.highlightA.value);
    content.style.setProperty("--highlight-b",E.highlightB.value);
    content.style.setProperty("--image-width",E.imageWidth.value+"%");
    content.style.setProperty("--chat-bg",E.chatBg.value);
    content.style.setProperty("--left-bubble",E.leftBubble.value);
    content.style.setProperty("--right-bubble",E.rightBubble.value);
    content.style.setProperty("--left-bubble-text",E.leftBubbleText.value);
    content.style.setProperty("--right-bubble-text",E.rightBubbleText.value);
    content.style.setProperty("--bubble-font-size",E.bubbleFontSize.value+"px");
    content.style.setProperty("--bubble-line-height",E.bubbleLineHeight.value+"px");
    content.style.setProperty("--bubble-padding",E.bubblePadding.value+"px");
    content.style.setProperty("--bubble-gap",E.bubbleGap.value+"px");
    content.style.setProperty("--name-gap",E.nameGap.value+"px");
    content.style.setProperty("--bubble-width",E.bubbleWidth.value+"%");
    content.style.textShadow=E.textShadow.checked?"0 1px 2px rgba(0,0,0,.14)":"none";
    content.classList.toggle("columns-2",Number(state.columns)===2);
    content.classList.toggle("no-guides",!state.guides);
    $$(".p",content).forEach(p=>p.style.marginBottom=E.paragraphGap.value+"px");

    // horizontal scale without changing layout width too much
    const sx=Number(E.scaleX.value)/100;
    content.style.transform=`scaleX(${sx})`;
    content.style.width=(100/sx)+"%";

    const bg=$(".bg-layer"), ov=$(".overlay-layer");
    bg.style.filter=`blur(${E.bgBlur.value}px)`;
    if(state.bgMode==="solid"){
      bg.style.background=E.bgColor1.value; ov.style.background="transparent";
    } else if(state.bgMode==="gradient"){
      bg.style.background=`linear-gradient(${E.gradientAngle.value}deg, ${E.bgColor1.value}, ${E.bgColor2.value})`; ov.style.background="transparent";
    } else if(state.bgMode==="image"){
      bg.style.background=state.bgImage?`url("${state.bgImage}") center/cover no-repeat`:E.bgColor1.value;
      ov.style.background=hexToRgba(E.overlayColor.value,Number(E.overlayOpacity.value)/100);
    } else {
      bg.style.background="transparent"; ov.style.background="transparent";
    }

    content.innerHTML="";
    content.appendChild(parsePage(E.contentInput.value));

    requestAnimationFrame(()=>{
      if(fixedH){
        const inner=$(".canvas-inner");
        const overflow=inner.scrollHeight > canvas.clientHeight+2;
        $("#overflowToast").classList.toggle("hidden",!overflow);
      } else $("#overflowToast").classList.add("hidden");
    });
  }

  function hexToRgba(hex,a){
    const n=parseInt(hex.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  function insertText(before, after="", placeholder="텍스트"){
    const ta=E.contentInput, s=ta.selectionStart, e=ta.selectionEnd;
    const selected=ta.value.slice(s,e) || placeholder;
    ta.setRangeText(before+selected+after,s,e,"end"); ta.focus(); render();
  }

  $$("[data-wrap]").forEach(b=>b.addEventListener("click",()=>insertText(`<${b.dataset.wrap}>`,`</${b.dataset.wrap}>`)));
  $$("[data-line]").forEach(b=>b.addEventListener("click",()=>insertText(`|${b.dataset.line} `,"","강조할 문장")));
  $("#insertDivider").onclick=()=>insertText("\n---\n","","");
  $("#insertPageBreak").onclick=()=>insertText("\n===\n","","");
  $("#insertLeftBubble").onclick=()=>insertText("> ","","대사");
  $("#insertRightBubble").onclick=()=>insertText("< ","","대사");
  $("#clearContent").onclick=()=>{ if(confirm("본문을 비울까요?")){E.contentInput.value="";render();} };
  $("#toggleGuides").onclick=()=>{state.guides=!state.guides;$("#toggleGuides").textContent=state.guides?"줄 표시 해제":"줄 표시";render();};

  $("#insertPhoto").onclick=()=>$("#inlineImageInput").click();
  $("#inlineImageInput").onchange=async e=>{
    const f=e.target.files[0]; if(!f)return;
    const data=await fileToDataURL(f); const key="img_"+Date.now(); state.inlineImages[key]=data;
    insertText(`\n[[image:${key}]]\n`,"","");
    e.target.value="";
  };
  $("#bgImageInput").onchange=async e=>{
    const f=e.target.files[0]; if(!f)return; state.bgImage=await fileToDataURL(f); state.bgMode="image"; syncSegmented(); render();
  };
  $("#fontUpload").onchange=async e=>{
    const f=e.target.files[0]; if(!f)return;
    const data=await fileToDataURL(f); const name="CustomLogFont";
    const style=document.createElement("style");
    style.textContent=`@font-face{font-family:'${name}';src:url('${data}');font-display:swap}`;
    document.head.appendChild(style); state.customFontName=name;
    try{ await document.fonts.load(`16px '${name}'`); }catch{}
    render();
  };
  function fileToDataURL(file){ return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);}); }

  ids.forEach(id=>{
    const el=E[id]; if(!el)return;
    el.addEventListener(el.type==="range"||el.type==="color"?"input":"change",render);
    if(["text","textarea"].includes(el.type) || el.tagName==="TEXTAREA") el.addEventListener("input",render);
  });

  const bindSeg=(selector,key,dataKey,cast=v=>v)=>{
    $$(selector+" button").forEach(b=>b.onclick=()=>{state[key]=cast(b.dataset[dataKey]);syncSegmented();render();});
  };
  bindSeg("#weightButtons","fontWeight","weight");
  bindSeg("#alignButtons","align","align");
  bindSeg("#wrapButtons","wrapMode","wrapmode");
  bindSeg("#bubbleStyleButtons","bubbleStyle","bubblestyle");
  bindSeg("#ratioButtons","ratio","ratio");
  bindSeg("#columnButtons","columns","columns",Number);
  bindSeg("#backgroundButtons","bgMode","bg");

  // Zoom
  function setZoom(z){state.zoom=Math.max(35,Math.min(160,z));$("#zoomRange").value=state.zoom;$("#zoomLabel").textContent=state.zoom+"%";canvas.style.transform=`scale(${state.zoom/100})`;stage.style.paddingBottom=(62 + canvas.offsetHeight*(state.zoom/100-1))+"px";}
  $("#zoomRange").oninput=e=>setZoom(Number(e.target.value));
  $("#zoomOut").onclick=()=>setZoom(state.zoom-10); $("#zoomIn").onclick=()=>setZoom(state.zoom+10);
  $("#zoomFit").onclick=()=>{
    const room=Math.max(280,$(".workspace").clientWidth-70), w=Number(E.canvasWidth.value);
    setZoom(Math.min(100,Math.floor(room/w*100)));
  };

  // Presets
  function getPresets(){ try{return JSON.parse(localStorage.getItem("logMakerPresets")||"{}")}catch{return{}} }
  function savePresets(p){localStorage.setItem("logMakerPresets",JSON.stringify(p));renderPresetList();}
  function renderPresetList(){
    const list=$("#presetList"), p=getPresets(); list.innerHTML="";
    Object.keys(p).forEach(name=>{
      const chip=document.createElement("div");chip.className="preset-chip";
      const use=document.createElement("button");use.textContent=name;use.onclick=()=>applySettingsObject(p[name]);
      const x=document.createElement("button");x.className="x";x.textContent="×";x.onclick=()=>{delete p[name];savePresets(p)};
      chip.append(use,x);list.appendChild(chip);
    });
    if(!Object.keys(p).length) list.innerHTML='<span class="help">아직 저장된 프리셋이 없어요.</span>';
  }
  $("#savePreset").onclick=()=>{
    const name=$("#presetName").value.trim(); if(!name)return alert("프리셋 이름을 적어주세요.");
    const p=getPresets();p[name]=settingKeys();savePresets(p);$("#presetName").value="";
  };
  $("#copySettings").onclick=async()=>{
    const code=btoa(unescape(encodeURIComponent(JSON.stringify(settingKeys()))));
    await safeCopyText(code); alert("설정 코드를 복사했어요.");
  };
  $("#applySettings").onclick=()=>$("#settingsDialog").showModal();
  $("#confirmSettings").onclick=()=>{
    try{const obj=JSON.parse(decodeURIComponent(escape(atob($("#settingsCode").value.trim()))));applySettingsObject(obj);$("#settingsDialog").close();}
    catch{alert("설정 코드를 읽을 수 없어요.");}
  };
  $("#resetSettings").onclick=()=>{ if(confirm("서식 설정을 초기값으로 되돌릴까요?")) location.reload(); };

  $("#showSyntax").onclick=()=>$("#syntaxDialog").showModal();
  $$("dialog [data-close]").forEach(b=>b.onclick=()=>b.closest("dialog").close());

  async function safeCopyText(t){
    try{await navigator.clipboard.writeText(t)}catch{
      const ta=document.createElement("textarea");ta.value=t;document.body.append(ta);ta.select();document.execCommand("copy");ta.remove();
    }
  }

  // Export using browser-native SVG foreignObject snapshot.
  function cloneForExport(rawText=null){
    const original=E.contentInput.value;
    if(rawText!==null){E.contentInput.value=rawText;render();}
    const clone=canvas.cloneNode(true);
    clone.style.transform="none"; clone.style.boxShadow="none";
    if(rawText!==null){E.contentInput.value=original;render();}
    return clone;
  }

  async function nodeToCanvas(node, scale=2, format="png"){
    await document.fonts.ready;
    const rect=canvas.getBoundingClientRect();
    const width=Number(E.canvasWidth.value);
    const height=canvas.offsetHeight;
    const css=await collectCSS();
    const wrap=document.createElement("div");
    wrap.setAttribute("xmlns","http://www.w3.org/1999/xhtml");
    wrap.style.width=width+"px";wrap.style.height=height+"px";
    wrap.appendChild(node);
    const serializer=new XMLSerializer();
    const xhtml=serializer.serializeToString(wrap);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><style>${escapeStyle(css)}</style>${xhtml}</foreignObject></svg>`;
    const blob=new Blob([svg],{type:"image/svg+xml;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    try{
      const img=await loadImage(url);
      const out=document.createElement("canvas");out.width=Math.round(width*scale);out.height=Math.round(height*scale);
      const ctx=out.getContext("2d");
      if(format==="jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,out.width,out.height);}
      ctx.drawImage(img,0,0,out.width,out.height);
      return out;
    } finally {URL.revokeObjectURL(url);}
  }

  async function collectCSS(){
    let css="";
    for(const sheet of [...document.styleSheets]){
      try{ for(const rule of [...sheet.cssRules]) css += rule.cssText+"\n"; }catch{}
    }
    return css;
  }
  function escapeStyle(css){return css.replace(/<\/style/gi,"<\\/style")}
  function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
  function canvasBlob(c,fmt){
    const type=fmt==="jpeg"?"image/jpeg":fmt==="webp"?"image/webp":"image/png";
    return new Promise(res=>c.toBlob(res,type,fmt==="jpeg"?0.94:0.96));
  }
  function downloadBlob(blob,name){
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
  }

  async function exportOne(raw=null,suffix=""){
    try{
      const clone=cloneForExport(raw);
      const scale=Number(E.exportScale.value), fmt=E.exportFormat.value;
      const c=await nodeToCanvas(clone,scale,fmt), blob=await canvasBlob(c,fmt);
      const ext=fmt==="jpeg"?"jpg":fmt;
      downloadBlob(blob,`${E.fileName.value||"log-image"}${suffix}.${ext}`);
    }catch(err){
      console.error(err);
      alert("이미지 변환에 실패했어요. 브라우저에서 직접 열었을 때는 Chrome/Safari 최신 버전을 권장해요.");
    }
  }
  $("#saveImage").onclick=()=>exportOne();
  $("#saveSplit").onclick=async()=>{
    const pages=E.contentInput.value.split(/\n?===\n?/);
    if(pages.length<2) return exportOne();
    for(let i=0;i<pages.length;i++) await exportOne(pages[i],`-${String(i+1).padStart(2,"0")}`);
  };
  $("#copyImage").onclick=async()=>{
    try{
      const fmt="png", c=await nodeToCanvas(cloneForExport(),Number(E.exportScale.value),fmt), blob=await canvasBlob(c,fmt);
      if(navigator.clipboard && window.ClipboardItem){
        await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]); alert("이미지를 클립보드에 복사했어요.");
      }else alert("이 브라우저는 이미지 복사를 지원하지 않아요. 이미지 저장을 이용해 주세요.");
    }catch(err){console.error(err);alert("이미지 복사에 실패했어요.");}
  };

  // autosave text/settings in this browser
  let saveTimer;
  function autoSave(){
    clearTimeout(saveTimer);saveTimer=setTimeout(()=>{
      localStorage.setItem("logMakerDraft",E.contentInput.value);
      localStorage.setItem("logMakerLastSettings",JSON.stringify(settingKeys()));
    },250);
  }
  $$("input,textarea,select").forEach(el=>el.addEventListener("input",autoSave));
  E.contentInput.addEventListener("change",autoSave);
  const draft=localStorage.getItem("logMakerDraft");
  if(draft!==null) E.contentInput.value=draft;
  try{
    const last=JSON.parse(localStorage.getItem("logMakerLastSettings")||"null");
    if(last) applySettingsObject(last);
  }catch{}

  renderPresetList();syncSegmented();render();setZoom(100);
})();