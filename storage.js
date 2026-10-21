/* exported HuntStore */
'use strict';

// All åtkomst till localStorage samlad på ett ställe. Nycklarna är desamma som i v1.0
// så att jakter som redan finns sparade i telefonerna fortsätter att fungera.
const HuntStore = (() => {
    const KEYS = {
        huntPrefix: 'bjorklundsRapportHunt_',
        activeHuntId: 'bjorklundsRapportActiveHuntId',
        huntIndex: 'bjorklundsRapportSavedHuntsIndex',
        lastTab: 'bjorklundsRapportLastActiveTab',
        introShownDate: 'bjorklundsRapportLastIntroVideoShown',
        theme: 'theme',
    };

    function read(key) {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.error('Kunde inte spara', key, error);
            return false;
        }
    }

    function remove(key) {
        try {
            localStorage.removeItem(key);
        } catch {
            // Inget att göra om lagringen inte går att nå.
        }
    }

    function getIndex() {
        try {
            const index = JSON.parse(read(KEYS.huntIndex) || '[]');
            return Array.isArray(index) ? index : [];
        } catch {
            return [];
        }
    }

    return {
        // Index över sparade jakter: [{ id, dateString, itemCount }].
        getIndex,
        getIndexNewestFirst() {
            return getIndex().sort((a, b) => new Date(b.dateString) - new Date(a.dateString));
        },
        getIndexEntry(huntId) {
            return getIndex().find((entry) => entry.id === huntId) || null;
        },
        saveIndex(index) {
            return write(KEYS.huntIndex, JSON.stringify(index));
        },

        // Returnerar null om jakten saknas och kastar om den sparade datan är trasig.
        loadHunt(huntId) {
            const raw = read(KEYS.huntPrefix + huntId);
            return raw === null ? null : JSON.parse(raw);
        },
        saveHunt(huntId, data) {
            return write(KEYS.huntPrefix + huntId, JSON.stringify(data));
        },
        deleteHunt(huntId) {
            remove(KEYS.huntPrefix + huntId);
        },
        deleteAllHunts() {
            getIndex().forEach((entry) => remove(KEYS.huntPrefix + entry.id));
            remove(KEYS.huntIndex);
        },

        getActiveHuntId: () => read(KEYS.activeHuntId),
        setActiveHuntId: (huntId) => write(KEYS.activeHuntId, huntId),

        getTheme: () => read(KEYS.theme),
        setTheme: (theme) => write(KEYS.theme, theme),
        getLastTab: () => read(KEYS.lastTab),
        setLastTab: (tabId) => write(KEYS.lastTab, tabId),
        getIntroShownDate: () => read(KEYS.introShownDate),
        setIntroShownDate: (dateString) => write(KEYS.introShownDate, dateString),
    };
})();
