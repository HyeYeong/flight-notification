export const COMMANDS = {
  CANCEL: ["취소", "cancel"],
  LANG_KO: ["한국어", "ko"],
  LANG_JA: ["日本語", "일본어", "jp"],
  LANG_CHANGE: ["언어", "言語", "lang", "언어변경"],
  LIST: ["목록", "リスト", "list"],
  DELETE: ["삭제", "削除", "delete"],
  REGISTER: ["등록", "알림등록", "登録", "アラート登録", "add alert"]
};

export const checkCmd = (text, cmdList) => {
  return cmdList.some(c => c.toLowerCase() === text.toLowerCase());
};

export const COMMON_SENTENCES = {
  CHANGE_LANG_KO: "🇰🇷 설정이 한국어로 변경되었습니다. (통화: KRW)",
  CHANGE_LANG_JA: "🇯🇵 設定が日本語に変更されました。(通貨: JPY)",
};

// 편도/왕복 레이블 공통 사전
export const FLIGHT_TYPE_LABELS = {
  roundTrip: { ko: '왕복', ja: '往復' },
  oneWay: { ko: '편도', ja: '片道' },
};

// flight_type(1=왕복, 2=편도)
export const getFlightTypeLabel = (flightType, lang) => {
  const key = flightType === 1 ? 'roundTrip' : 'oneWay';
  return FLIGHT_TYPE_LABELS[key][lang] || FLIGHT_TYPE_LABELS[key]['ko'];
};

export const getFlightTypeBracket = (flightType, lang) => {
  return `[${getFlightTypeLabel(flightType, lang)}]`;
};

const DICTIONARY = {
  ko: {
    cancel: "❌ 등록이 취소되었습니다. 대기 상태로 돌아갑니다.",
    dep: "🛫 출발 공항 코드를 영문 3자리로 입력해주세요. (예: ICN)",
    arr: "🛬 도착 공항 코드를 영문 3자리로 입력해주세요. (예: NRT)",
    flight_type_cli: "왕복/편도를 선택해주세요 (1: 왕복, 2: 편도)\n1. 왕복 (Round-trip)\n2. 편도 (One-way)",
    date: "📅 가는 날짜를 입력해주세요.\n시간대를 지정하려면 시간을 뒤에 붙여주세요.\n[입력 예시]\n2026-06-12 (시간 무관)\n2026-06-12 17:30-20:00 (특정 시간 사이)\n2026-06-12 17:30- (해당 시간 이후)",
    return_date: "📅 오는 날짜를 입력해주세요.\n(가는 날짜와 동일하게 시간 지정이 가능합니다.)",
    price: "💰 알림을 받을 목표 가격을 숫자만 입력해주세요. 단위: {currency}",
    done: "🎉 알림 등록이 완료되었습니다!",
    del_prompt: "🗑 삭제할 알림의 번호를 입력해주세요. 취소하려면 '취소'를 입력하세요.",
    deleted: "✅ 삭제되었습니다.",
    change_lang_ko: COMMON_SENTENCES.CHANGE_LANG_KO,
    change_lang_ja: COMMON_SENTENCES.CHANGE_LANG_JA,
    lang_prompt_cli: "언어를 선택해주세요 (ko 또는 jp를 입력)\nko: 한국어 (KRW)\njp: 日本語 (JPY)",
    lang_prompt_line: "언어를 선택해주세요 (ko 또는 jp를 입력)\nko: 한국어 (KRW)\njp: 日本語 (JPY)\n\n또는 아래 버튼을 눌러주세요",
    list_header: "📋 현재 등록된 알림 목록:\n",
    flight_alert_found: "✈️ 목표가 이하 항공편 발견!\n\n여정: {typeStr} {dep} -> {arr}\n가는날: {date}\n{returnStr}\n[최저가 순 랭킹]\n{flights}\n\n🔗 공식 예약처 구글플라이트 접속:\n{url}",
    flight_alert_not_found: "🕒 오늘 {time}에 비행편 검색을 시도했으나 조건에 맞는 항공편이 없습니다. ({dep} ➡️ {arr}, 출발일: {date})",
    flight_alert_not_met: "🕒 오늘 {time}에 검색을 시도했으나 목표가({targetPrice} {currency} 이하)에 도달한 항공편이 없습니다.\n(현재 최저가: {cheapestPrice} {currency}, {dep} ➡️ {arr}, 출발일: {date})",
    flight_alert_error: "⚠️ {dep} ➡️ {arr} (출발일: {date}) 검색 중 오류가 발생했습니다. (과거 날짜이거나 유효하지 않은 조건일 수 있습니다.)\n상세: {error}",
    // error msg
    cmd_unknown: "명령어를 알 수 없습니다. 사용 가능한 명령어: 등록(add alert), 목록(list), 삭제(delete), 언어변경(lang)",
    price_err: "숫자만 입력해주세요!",
    no_alert: "등록된 자동 알림이 없습니다.",
    invalid_num: "유효하지 않은 번호입니다.",
    error_flight_type: "1 또는 2를 입력해주세요.",
    invalid_airport: "⚠️ 공항 코드는 영문 3자리로 정확히 입력해주세요! (예: ICN)",
    invalid_date: "⚠️ 올바른 날짜 형식이 아닙니다 (예: 2026-06-12).",
  },
  ja: {
    cancel: "❌ キャンセルされました。最初の状態に戻ります。",
    dep: "🛫 出発空港コードを3文字で入力してください。（例：ICN）",
    arr: "🛬 到着空港コードを3文字で入力してください。（例：NRT）",
    flight_type_cli: "往復/片道を選択してください (1: 往復, 2: 片道)\n1. 往復 (Round-trip)\n2. 片道 (One-way)",
    date: "📅 出発日を入力してください。\n時間を指定する場合は、以下のように入力してください。\n[入力例]\n2026-06-12 (時間問わず)\n2026-06-12 17:30-20:00 (特定の時間帯)\n2026-06-12 17:30- (その時間以降)",
    return_date: "📅 到着日（帰りの日）を入力してください。\n(出発日と同様に時間の指定が可能です)",
    price: "💰 目安価格を数字のみで入力してください。単位: {currency}",
    done: "🎉 アラート登録が完了しました！",
    del_prompt: "🗑 削除するアラートの番号を入力してください。",
    deleted: "✅ 削除されました。",
    change_lang_ko: COMMON_SENTENCES.CHANGE_LANG_KO,
    change_lang_ja: COMMON_SENTENCES.CHANGE_LANG_JA,
    lang_prompt_cli: "言語を選択してください (ko または jpを入力)\nko: 한국어 (KRW)\njp: 日本語 (JPY)",
    lang_prompt_line: "言語を選択してください (ko または jpを入力)\nko: 한국어 (KRW)\njp: 日本語 (JPY)\n\nまたは下のボタンを押してください",
    list_header: "📋 アラート一覧:\n",
    flight_alert_found: "✈️ 目安価格以下のフライトを発見！\n\n旅程: {typeStr} {dep} -> {arr}\n出発日: {date}\n{returnStr}\n[最安値ランキング]\n{flights}\n\n🔗 Googleフライトで予約する:\n{url}",
    flight_alert_not_found: "🕒 本日 {time} に検索を試みましたが、条件に合うフライトがありませんでした。 ({dep} ➡️ {arr}, 出発日: {date})",
    flight_alert_not_met: "🕒 本日 {time} に検索を試みましたが、目標価格({targetPrice} {currency} 以下)に達したフライトがありません。\n（現在最安値: {cheapestPrice} {currency}, {dep} ➡️ {arr}, 出発日: {date}）",
    flight_alert_error: "⚠️ {dep} ➡️ {arr} (出発日: {date}) の検索中にエラーが発生しました。（過去の日付や無効な条件の可能性があります）\n詳細: {error}",
    // error msg
    cmd_unknown: "コマンドが不明です。使用可能なコマンド: 登録(add alert), リスト(list), 削除(delete), 言語変更 or 言語(lang)",
    price_err: "数字のみで入力してください！",
    no_alert: "登録されたアラートがありません。",
    invalid_num: "無効な番号です。",
    error_flight_type: "1 か 2 を入力してください。",
    invalid_airport: "⚠️ 空港コードはアルファベット3文字で入力してください！ (例: NRT)",
    invalid_date: "⚠️ 日付の形式が正しくありません (例: 2026-06-12)。",
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
