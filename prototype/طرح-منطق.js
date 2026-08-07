const TAB = "border:0;border-radius:8px;padding:6px 14px;font-size:13px;font-weight:700;cursor:pointer;background:transparent;color:#a8b0be";
const TAB_ON = "border:0;border-radius:8px;padding:6px 14px;font-size:13px;font-weight:700;cursor:pointer;background:#24405c;color:#cfe0f5";
class Component extends DCLogic {
  state = { view: "landing", step: 1, imgSel: 1, seed: 48211, dur: 30, ratio: "9:16", adminTab: "gateways" };
  set = (k, v) => this.setState({ [k]: v });
  renderVals() {
    const v = this.state.view;
    return {
      isLanding: v === "landing", isApp: v === "app", isAdmin: v === "admin",
      tabLanding: v === "landing" ? TAB_ON : TAB,
      tabApp: v === "app" ? TAB_ON : TAB,
      tabAdmin: v === "admin" ? TAB_ON : TAB,
      goLanding: () => this.set("view", "landing"),
      goApp: () => this.set("view", "app"),
      goAdmin: () => this.set("view", "admin"),
      step: this.state.step,
      s1: this.state.step === 1, s2: this.state.step === 2, s3: this.state.step === 3, s4: this.state.step === 4,
      steps: [1,2,3,4].map(n => ({
        n, label: ["ایده و بریف","تولید تصویر","بهینه‌سازی","تولید ویدیو"][n-1],
        go: () => this.set("step", n),
        style: "flex:1;min-width:150px;text-align:right;cursor:pointer;border:1px solid " + (this.state.step===n?"#4ea3ff":"#2a2f3a") + ";background:" + (this.state.step===n?"#10263d":"#171a21") + ";border-radius:12px;padding:12px 15px",
        numStyle: "font-size:11.5px;font-weight:800;direction:ltr;text-align:right;color:" + (this.state.step>=n?"#8fc4ff":"#7a8394"),
        txtStyle: "font-weight:700;font-size:14px;margin-top:3px;color:" + (this.state.step===n?"#fff":"#a8b0be"),
      })),
      next: () => this.set("step", Math.min(4, this.state.step + 1)),
      prev: () => this.set("step", Math.max(1, this.state.step - 1)),
      frames: [1,2,3,4].map(i => ({
        i, label: "frame_0" + i,
        style: "aspect-ratio:16/9;border-radius:11px;cursor:pointer;border:2px solid " + (this.state.imgSel===i?"#4ea3ff":"#2a2f3a") + ";background:repeating-linear-gradient(135deg,#171a21,#171a21 8px,#1d212a 8px,#1d212a 16px);display:flex;align-items:end;justify-content:space-between;padding:9px 11px",
        pick: () => this.set("imgSel", i),
        badge: this.state.imgSel === i ? "انتخاب‌شده" : "انتخاب",
        badgeStyle: "font-size:10.5px;font-weight:700;border-radius:5px;padding:1px 8px;" + (this.state.imgSel===i?"background:#123527;color:#5fe0b0;border:1px solid #1d5c43":"background:#1c2230;color:#7a8394;border:1px solid #2a2f3a"),
      })),
      seed: this.state.seed,
      onSeed: (e) => this.set("seed", Number(e.target.value)),
      reseed: () => this.set("seed", Math.floor(Math.random() * 99999)),
      dur: this.state.dur,
      onDur: (e) => this.set("dur", Number(e.target.value)),
      durLabel: this.state.dur + " ثانیه",
      cost: (this.state.dur * 12).toLocaleString("fa-IR") + " هزار تومان",
      adminTabs: [
        ["gateways","درگاه‌های هوش مصنوعی"],["models","رجیستری مدل‌ها"],["finance","مدیریت مالی"],["content","کنترل محتوا"],["users","کاربران"]
      ].map(([k,l]) => ({
        k, l, go: () => this.set("adminTab", k),
        style: "text-align:right;cursor:pointer;border:0;background:" + (this.state.adminTab===k?"#1d212a":"transparent") + ";color:" + (this.state.adminTab===k?"#fff":"#a8b0be") + ";border-radius:9px;padding:9px 13px;font-size:13.5px;font-weight:700",
      })),
      aGateways: this.state.adminTab === "gateways",
      aModels: this.state.adminTab === "models",
      aFinance: this.state.adminTab === "finance",
      aContent: this.state.adminTab === "content",
      aUsers: this.state.adminTab === "users",
    };
  }
}
</script>


</body></html>