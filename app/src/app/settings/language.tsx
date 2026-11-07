// Idioma da interface: a lista dos 14 idiomas pelo endônimo. Escolher troca na hora (a raiz remonta).
import { ScrollView } from 'react-native';
import { APP_LANGS } from '@sensus/core';
import { ListGroup, ListRow, useTheme } from '@/design';
import { useAppPrefs } from '@/settings/app-prefs';
import { SETTINGS_COPY as COPY } from '@/settings/strings';
import { useLang } from '@/i18n';

export default function LanguageScreen() {
  const { c } = useTheme();
  const lang = useLang();
  const setAppLang = useAppPrefs((s) => s.setAppLang);

  return (
    <ScrollView testID="settings-language" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }} contentInsetAdjustmentBehavior="automatic">
      <ListGroup>
        {APP_LANGS.map((info, i) => (
          <ListRow
            key={info.code}
            testID={`language-${info.code}`}
            first={i === 0}
            title={info.endonym}
            subtitle={info.code === lang ? COPY.langInUse : info.bcp47}
            onPress={() => {
              if (info.code !== lang) setAppLang(info.code);
            }}
          />
        ))}
      </ListGroup>
    </ScrollView>
  );
}
