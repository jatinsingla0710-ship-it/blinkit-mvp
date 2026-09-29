export type SalesLocale = 'en' | 'hi';

const en = {
  'nav.home': 'Home',
  'nav.orders': 'Orders',
  'nav.customers': 'Customers',
  'nav.profile': 'Profile',
  'offline.banner': "You're offline. Showing the last loaded data. New saves wait until you are back online.",
  'offline.waiting': 'Items on this phone are waiting to send. Orders are not sent until you are online.',
  'offline.syncing': 'Sending saved items…',
  'offline.sent': 'Saved items were sent.',
  'offline.failed': 'Some saved items could not be sent. They stay on this phone. Orders were not retried.',
  'profile.messages': 'Messages',
  'profile.notices': 'Alerts',
  'profile.expenses': 'Expenses',
  'profile.returns': 'Returns',
  'profile.earnings': 'My Earnings',
  'messages.title': 'Messages',
  'messages.empty': 'No messages yet.',
  'messages.placeholder': 'Write a message',
  'messages.send': 'Send',
  'notices.title': 'Alerts',
  'notices.empty': 'No alerts.',
  'notices.enable': 'Turn on phone alerts',
  'notices.enabled': 'Phone alerts are on for this device.',
  'notices.unavailable': 'This phone can show alerts in the app. Browser push needs a push key on the server.',
  'visits.nearest': 'Nearest first',
  'visits.byTime': 'By time',
  'voice.add': 'Add voice note',
  'voice.stop': 'Stop recording',
  'voice.unsupported': 'Voice notes need a microphone on this phone.',
  'voice.saved': 'Voice note saved',
  'route.needsLocation': 'Allow location to sort the nearest shops first.',
} as const;

const hi: Record<keyof typeof en, string> = {
  'nav.home': 'होम',
  'nav.orders': 'ऑर्डर',
  'nav.customers': 'ग्राहक',
  'nav.profile': 'प्रोफ़ाइल',
  'offline.banner': 'आप ऑफ़लाइन हैं। आखिरी लोड किया डेटा दिख रहा है। नई सेव ऑनलाइन होने पर भेजी जाएगी।',
  'offline.waiting': 'इस फ़ोन पर कुछ चीज़ें भेजने के लिए रुकी हैं। ऑर्डर ऑनलाइन होने तक नहीं भेजे जाते।',
  'offline.syncing': 'रुकी हुई चीज़ें भेजी जा रही हैं…',
  'offline.sent': 'रुकी हुई चीज़ें भेज दी गईं।',
  'offline.failed': 'कुछ रुकी हुई चीज़ें नहीं भेजी जा सकीं। वे इस फ़ोन पर रहेंगी। ऑर्डर दोबारा नहीं भेजे गए।',
  'profile.messages': 'संदेश',
  'profile.notices': 'सूचनाएँ',
  'profile.expenses': 'खर्चे',
  'profile.returns': 'रिटर्न',
  'profile.earnings': 'मेरी कमाई',
  'messages.title': 'संदेश',
  'messages.empty': 'अभी कोई संदेश नहीं।',
  'messages.placeholder': 'संदेश लिखें',
  'messages.send': 'भेजें',
  'notices.title': 'सूचनाएँ',
  'notices.empty': 'कोई सूचना नहीं।',
  'notices.enable': 'फ़ोन सूचनाएँ चालू करें',
  'notices.enabled': 'इस फ़ोन पर सूचनाएँ चालू हैं।',
  'notices.unavailable': 'यह फ़ोन ऐप में सूचना दिखा सकता है। ब्राउज़र पुश के लिए सर्वर पर पुश कुंजी चाहिए।',
  'visits.nearest': 'सबसे नज़दीक पहले',
  'visits.byTime': 'समय के अनुसार',
  'voice.add': 'आवाज़ नोट जोड़ें',
  'voice.stop': 'रिकॉर्डिंग रोकें',
  'voice.unsupported': 'आवाज़ नोट के लिए इस फ़ोन पर माइक्रोफ़ोन चाहिए।',
  'voice.saved': 'आवाज़ नोट सहेजा गया',
  'route.needsLocation': 'नज़दीकी दुकान पहले दिखाने के लिए लोकेशन की अनुमति दें।',
};

export type SalesMessageKey = keyof typeof en;

export function translate(locale: SalesLocale, key: SalesMessageKey): string {
  return locale === 'hi' ? hi[key] : en[key];
}

export function salesMessageKeys(): SalesMessageKey[] {
  return Object.keys(en) as SalesMessageKey[];
}
