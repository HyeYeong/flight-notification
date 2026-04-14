export const COMMANDS = {
  CANCEL: ["취소", "cancel"],
  LANG_KO: ["한국어", "ko", "1"],
  LANG_JA: ["日本語", "일본어", "jp", "2"],
  LANG_CHANGE: ["언어", "言語", "lang", "언어변경"],
  LIST: ["목록", "リスト", "list"],
  DELETE: ["삭제", "削除", "delete"],
  REGISTER: ["등록", "알림등록", "登録", "アラート登録", "add alert"]
};

export const checkCmd = (text, cmdList) => {
  return cmdList.some(c => c.toLowerCase() === text.toLowerCase());
};

const COMMON_SENTENCES = {
  CHANGE_LANG_KO: "🇰🇷 설정이 한국어로 변경되었습니다. (통화: KRW)",
  CHANGE_LANG_JA: "🇯🇵 設定が日本語に変更されました。(通貨: JPY)",
}

const DICTIONARY = {
  ko: {
    cancel: "❌ 등록이 취소되었습니다. 대기 상태로 돌아갑니다.",
    cmd_unknown: "명령어를 알 수 없습니다. 사용 가능한 명령어: 등록(add alert), 목록(list), 삭제(delete), 언어변경(lang)",
    dep: "🛫 출발 공항 코드를 영문 3자리로 입력해주세요. (예: ICN)",
    arr: "🛬 도착 공항 코드를 영문 3자리로 입력해주세요. (예: NRT)",
    date: "📅 가는 날짜를 입력해주세요. (예: 2026-06-01)",
    price: "💰 알림을 받을 목표 가격을 숫자만 입력해주세요. 단위: {currency}",
    price_err: "숫자만 입력해주세요!",
    done: "🎉 알림 등록이 완료되었습니다!",
    no_alert: "등록된 자동 알림이 없습니다.",
    del_prompt: "🗑 삭제할 알림의 번호를 입력해주세요. 취소하려면 '취소'를 입력하세요.",
    invalid_num: "유효하지 않은 번호입니다.",
    deleted: "✅ 삭제되었습니다.",
    change_lang_ko: COMMON_SENTENCES.CHANGE_LANG_KO,
    change_lang_ja: COMMON_SENTENCES.CHANGE_LANG_JA,
    lang_prompt_cli: "언어를 선택해주세요 (1 or 2를 입력)\n1. 한국어 (KRW)\n2. 日本語 (JPY)",
    lang_prompt_line: "언어를 선택해주세요 (1 or 2를 입력)\n1. 한국어 (KRW)\n2. 日本語 (JPY)\n\n또는 아래 버튼을 눌러주세요",
    list_header: "📋 현재 등록된 알림 목록:\n",
    flight_alert_found: "✈️ 목표가 이하 항공편 발견!\n\n여정: {dep} -> {arr}\n날짜: {date}\n\n[최저가 순 랭킹]\n{flights}\n\n🔗 공식 예약처 구글플라이트 접속:\n{url}"
  },
  ja: {
    cancel: "❌ キャンセルされました。最初の状態に戻ります。",
    cmd_unknown: "コマンドが不明です。使用可能なコマンド: 登録(add alert), リスト(list), 削除(delete), 言語変更 or 言語(lang)",
    dep: "🛫 出発空港コードを3文字で入力してください。（例：ICN）",
    arr: "🛬 到着空港コードを3文字で入力してください。（例：NRT）",
    date: "📅 出発日を入力してください。（例：2026-06-01）",
    price: "💰 目安価格を数字のみで入力してください。単位: {currency}",
    price_err: "数字のみで入力してください！",
    done: "🎉 アラート登録が完了しました！",
    no_alert: "登録されたアラートがありません。",
    del_prompt: "🗑 削除するアラートの番号を入力してください。",
    invalid_num: "無効な番号です。",
    deleted: "✅ 削除されました。",
    change_lang_ko: COMMON_SENTENCES.CHANGE_LANG_KO,
    change_lang_ja: COMMON_SENTENCES.CHANGE_LANG_JA,
    lang_prompt_cli: "言語を選択してください (1 or 2を入力)\n1. 한국어 (KRW)\n2. 日本語 (JPY)",
    lang_prompt_line: "言語を選択してください (1 or 2を入力)\n1. 한국어 (KRW)\n2. 日本語 (JPY)\n\nまたは下のボタンを押してください",
    list_header: "📋 アラート一覧:\n",
    flight_alert_found: "✈️ 目安価格以下のフライトを発見！\n\n旅程: {dep} -> {arr}\n日付: {date}\n\n[最安値ランキング]\n{flights}\n\n🔗 Googleフライトで予約する:\n{url}"
  }
};

export const t = (lang, key, params = {}) => {
  const dictionary = DICTIONARY[lang] || DICTIONARY['ko'];
  let msg = dictionary[key] || DICTIONARY['ko'][key] || key;

  for (const [k, v] of Object.entries(params)) {
    msg = msg.replaceAll(`{${k}}`, String(v));
  }
  return msg;
};
