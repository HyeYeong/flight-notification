import { UserState } from "../models/UserState.js";
import { FlightAlert } from "../models/FlightAlert.js";
import { t, COMMANDS, checkCmd, getFlightTypeLabel, getFlightTypeBracket } from "../utils/messages.js";

export async function processUserMessage(userId, userText, adapter) {
  let user = await UserState.findOne({ lineUserId: userId });
  if (!user) {
    user = await UserState.create({ lineUserId: userId });
  }

  const text = userText.trim();
  const lang = user.language || 'ko';

  if (checkCmd(text, COMMANDS.CANCEL)) {
    user.step = 0;
    user.tempData = {};
    await user.save();
    return adapter.sendText(t(lang, 'cancel'));
  }

  // ── admin login: "command: admin [password]" ──────────────────────────────
  if (text.toLowerCase().startsWith('admin ')) {
    const inputPassword = text.slice(6).trim();
    const adminSecret = process.env.CRON_SECRET;
    if (inputPassword === adminSecret) {
      user.isAdmin = true;
      await user.save();
      return adapter.sendText(lang === 'ko'
        ? '🔑 관리자 로그인 성공!\n`search now` 를 입력하면 즉시 항공권 검색을 시작합니다.'
        : '🔑 管理者ログイン成功！\n`search now` と入力するとすぐに検索を開始します。');
    } else {
      return adapter.sendText(lang === 'ko' ? '❌ 비밀번호가 틀렸습니다.' : '❌ パスワードが間違っています。');
    }
  }

  // ── admin only: "search now" ──────────────────────
  if (text.toLowerCase() === 'search now') {
    if (!user.isAdmin) {
      return adapter.sendText(lang === 'ko' ? '❌ 관리자 권한이 필요합니다. `admin [비밀번호]` 로 먼저 로그인해 주세요.' : '❌ 管理者権限が必要です。先に `admin [パスワード]` でログインしてください。');
    }
    // 비동기 call cron API (응답은 바로 보내고 백그라운드에서 검색 실행)
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const cronUrl = `${baseUrl}/api/cron?reportTo=${encodeURIComponent(userId)}`;
    import('axios').then(({ default: axios }) => {
      axios.get(cronUrl, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
      }).catch(e => console.error('Admin search trigger error:', e.message));
    });
    return adapter.sendText(lang === 'ko'
      ? '🔍 검색을 시작합니다! 목표가에 도달한 항공편이 있으면 알림을 보내드립니다.'
      : '🔍 検索を開始します！目標価格以下の便が見つかった場合、通知をお送りします。');
  }

  if (checkCmd(text, COMMANDS.LANG_KO)) {
    if (user.currency === "JPY") {
      const alerts = await FlightAlert.find({ lineUserId: userId });
      for (const a of alerts) {
        a.target_price = Math.round(a.target_price * 10);
        await a.save();
      }
    }
    user.language = "ko";
    user.currency = "KRW";
    user.step = 0;
    await user.save();
    return adapter.sendText(t('ko', 'change_lang_ko'));
  }

  if (checkCmd(text, COMMANDS.LANG_JA)) {
    if (user.currency === "KRW") {
      const alerts = await FlightAlert.find({ lineUserId: userId });
      for (const a of alerts) {
        a.target_price = Math.round(a.target_price / 10);
        await a.save();
      }
    }
    user.language = "ja";
    user.currency = "JPY";
    user.step = 0;
    await user.save();
    return adapter.sendText(t('ja', 'change_lang_ja'));
  }

  if (checkCmd(text, COMMANDS.LANG_CHANGE)) {
    user.step = 100; // 언어변경 대기모드
    await user.save();
    return adapter.sendQuickReply(t(lang, 'lang_prompt_line'), [
      { type: "action", action: { type: "message", label: "🇰🇷 한국어(KRW)", text: "ko" } },
      { type: "action", action: { type: "message", label: "🇯🇵 日本語(JPY)", text: "jp" } }
    ]);
  }

  if (user.step === 100) {
    if (checkCmd(text, COMMANDS.LANG_KO)) {
      user.language = "ko";
      user.currency = "KRW";
      user.step = 0;
      await user.save();
      return adapter.sendText(t('ko', 'change_lang_ko'));
    } else if (checkCmd(text, COMMANDS.LANG_JA)) {
      user.language = "ja";
      user.currency = "JPY";
      user.step = 0;
      await user.save();
      return adapter.sendText(t('ja', 'change_lang_ja'));
    } else {
      return adapter.sendQuickReply(`${t(lang, 'cmd_unknown')}\n\n${t(lang, 'lang_prompt_line')}`, [
        { type: "action", action: { type: "message", label: "🇰🇷 한국어(KRW)", text: "ko" } },
        { type: "action", action: { type: "message", label: "🇯🇵 日本語(JPY)", text: "jp" } }
      ]);
    }
  }

  const formatAlertList = (alerts, lang, currency, showPrice = false) => {
    return alerts.map((a, idx) => {
      let dateField = a.outbound_date;
      if (a.flight_type === 1 && a.return_date) {
        dateField += `\n  - 2nd✈️ : ${a.return_date}`;
      }

      const flightTypeDisplay = getFlightTypeLabel(a.flight_type, lang);
      if (showPrice) {
        const priceText = lang === 'ko' ? `목표: ${a.target_price.toLocaleString()} ${currency} 이하` : `目標: ${a.target_price.toLocaleString()} ${currency} 以下`;
        return `${idx + 1}.[${a.departure_id} ~ ${a.arrival_id}] ${flightTypeDisplay}\n  - 1st✈️ : ${dateField}\n   (${priceText})\n`;
      }
      return `${idx + 1}.[${a.departure_id} ~ ${a.arrival_id}] ${flightTypeDisplay} \n  - 1st✈️ : ${dateField}\n`;
    }).join('\n');
  };

  if (checkCmd(text, COMMANDS.LIST)) {
    const alerts = await FlightAlert.find({ lineUserId: userId, isActive: true });
    if (alerts.length === 0) return adapter.sendText(t(lang, 'no_alert'));
    const listMsg = formatAlertList(alerts, lang, user.currency, true);
    return adapter.sendText(`${t(lang, 'list_header')}${listMsg}`);
  }

  if (checkCmd(text, COMMANDS.DELETE)) {
    const alerts = await FlightAlert.find({ lineUserId: userId, isActive: true });
    if (alerts.length === 0) return adapter.sendText(t(lang, 'no_alert'));
    const listMsg = formatAlertList(alerts, lang, user.currency, false);
    user.step = 200; // 알림삭제 대기모드
    await user.save();
    return adapter.sendText(`${t(lang, 'del_prompt')}\n\n${listMsg}`);
  }

  if (user.step === 200) {
    const alerts = await FlightAlert.find({ lineUserId: userId, isActive: true });
    const idx = Number(text) - 1;
    if (isNaN(idx) || idx < 0 || idx >= alerts.length) {
      const listMsg = formatAlertList(alerts, lang, user.currency, false);
      return adapter.sendText(`${t(lang, 'invalid_num')}\n\n${t(lang, 'del_prompt')}\n\n${listMsg}`);
    }
    await FlightAlert.deleteOne({ _id: alerts[idx]._id });
    user.step = 0;
    await user.save();
    return adapter.sendText(t(lang, 'deleted'));
  }

  if (user.step === 0) {
    if (checkCmd(text, COMMANDS.REGISTER)) {
      user.step = 1;
      user.tempData = {};
      await user.save();
      return adapter.sendText(t(lang, 'dep'));
    } else {
      return adapter.sendText(t(lang, 'cmd_unknown'));
    }
  }

  if (user.step === 1) {
    if (!/^[a-zA-Z]{3}$/.test(text)) {
      return adapter.sendText(`${t(lang, 'invalid_airport')}\n\n${t(lang, 'dep')}`);
    }
    user.tempData.departure_id = text.toUpperCase();
    user.step = 2;
    await user.save();
    return adapter.sendText(t(lang, 'arr'));
  }

  if (user.step === 2) {
    if (!/^[a-zA-Z]{3}$/.test(text)) {
      return adapter.sendText(`${t(lang, 'invalid_airport')}\n\n${t(lang, 'arr')}`);
    }
    user.tempData.arrival_id = text.toUpperCase();
    user.step = 3;
    await user.save();
    return adapter.sendQuickReply(
      lang === 'ko' ? "왕복/편도를 선택해주세요." : "往復/片道を選択してください。",
      [
        { type: "action", action: { type: "message", label: lang === 'ko' ? "1. 왕복" : "1. 往復", text: "1" } },
        { type: "action", action: { type: "message", label: lang === 'ko' ? "2. 편도" : "2. 片道", text: "2" } }
      ]
    );
  }

  if (user.step === 3) {
    if (text === "1" || text === "왕복" || text === "round" || text === "往復") {
      user.tempData.flight_type = 1;
    } else if (text === "2" || text === "편도" || text === "oneway" || text === "片道") {
      user.tempData.flight_type = 2;
    } else {
      return adapter.sendQuickReply(
        `${t(lang, 'error_flight_type')}\n\n${lang === 'ko' ? "왕복/편도를 선택해주세요." : "往復/片道を選択してください。"}`,
        [
          { type: "action", action: { type: "message", label: lang === 'ko' ? "1. 왕복" : "1. 往復", text: "1" } },
          { type: "action", action: { type: "message", label: lang === 'ko' ? "2. 편도" : "2. 片道", text: "2" } }
        ]
      );
    }
    user.step = 4;
    await user.save();
    return adapter.sendText(t(lang, 'date'));
  }

  if (user.step === 4) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(text)) {
      return adapter.sendText(`${t(lang, 'invalid_date')}\n\n${t(lang, 'date')}`);
    }
    user.tempData.outbound_date = text;
    if (user.tempData.flight_type === 1) {
      user.step = 5;
      await user.save();
      return adapter.sendText(t(lang, 'return_date'));
    } else {
      user.step = 6;
      await user.save();
      return adapter.sendText(t(lang, 'price', { currency: user.currency }));
    }
  }

  if (user.step === 5) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(text)) {
      return adapter.sendText(`${t(lang, 'invalid_date')}\n\n${t(lang, 'return_date')}`);
    }
    user.tempData.return_date = text;
    user.step = 6;
    await user.save();
    return adapter.sendText(t(lang, 'price', { currency: user.currency }));
  }

  if (user.step === 6) {
    const targetPrice = Number(text);
    if (isNaN(targetPrice)) {
      return adapter.sendText(`${t(lang, 'price_err')}\n\n${t(lang, 'price', { currency: user.currency })}`);
    }

    await FlightAlert.create({
      lineUserId: userId,
      departure_id: user.tempData.departure_id,
      arrival_id: user.tempData.arrival_id,
      flight_type: user.tempData.flight_type,
      outbound_date: user.tempData.outbound_date,
      return_date: user.tempData.return_date,
      target_price: targetPrice
    });

    const isRound = user.tempData.flight_type === 1;
    const dep = user.tempData.departure_id;
    const arr = user.tempData.arrival_id;
    const outDate = user.tempData.outbound_date;
    const retDate = user.tempData.return_date;
    const typeStr = getFlightTypeBracket(user.tempData.flight_type, lang);

    user.step = 0;
    user.tempData = {};
    await user.save();

    let textOut = `${t(lang, 'done')}\n${typeStr} ${dep} -> ${arr}\n가는날: ${outDate}`;
    if (isRound) textOut += `\n오는날: ${retDate}`;
    textOut += `\n(목표가: ${targetPrice.toLocaleString()} ${user.currency})`;

    return adapter.sendText(textOut);
  }
}
