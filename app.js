'use strict';

(() => {
    // ---------- Konstanter ----------

    // Fast adress så att QR-koden aldrig får med sökparametrar eller lokala adresser.
    const APP_URL = 'https://stevoxa.github.io/bjorklunds-rapport/';

    const MEAT_TEMPLATES = [
        'köper köttet. Hänger endast upp i slakteriet.',
        'köper köttet. Hänger upp i slakteriet och TM styckar.',
        'tilldelas köttet. Hänger endast upp i slakteriet.',
        'tilldelas köttet. Hänger upp i slakteriet och TM styckar.',
        'Jaktklubben tar köttet. Hänger upp i slakteriet och TM styckar.',
        'köper köttet och tar med sig hem.',
        'tilldelas köttet och tar med sig hem.',
        'Jaktklubben tar köttet.',
    ];

    const ICONS = {
        trash: '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
        check: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>',
        warning:
            '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
    };

    const NO_ACTIVE_HUNT_MESSAGE = 'Ingen aktiv jakt vald. Starta en ny eller ladda en befintlig jakt först.';

    // ---------- Tillstånd ----------

    // Den aktiva jakten. reports innehåller skott, såt-avdelare och fällt vilt i samma lista.
    const hunt = {
        id: null,
        reports: [],
        nextSaaterToAssign: 1,
        saaterStates: {},
    };

    let lastIssuedId = 0;
    let viewedGameId = null;
    let confirmHandlers = { onConfirm: null, onCancel: null };
    let deferredInstallPrompt = null;
    let saveFailureShown = false;

    const dom = {};

    // ---------- Hjälpfunktioner ----------

    // Numeriska id:n som alltid är unika, även vid flera tryck inom samma millisekund.
    function nextId() {
        lastIssuedId = Math.max(Date.now(), lastIssuedId + 1);
        return lastIssuedId;
    }

    function pad2(value) {
        return String(value).padStart(2, '0');
    }

    function formatDate(date) {
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    }

    function formatTime(date) {
        return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }

    function newestFirst(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    }

    function shots() {
        return hunt.reports.filter((r) => r.itemType === 'shot');
    }

    function games() {
        return hunt.reports.filter((r) => r.itemType === 'game');
    }

    function findShot(id) {
        return hunt.reports.find((r) => r.itemType === 'shot' && r.id === id);
    }

    function findGame(id) {
        return hunt.reports.find((r) => r.itemType === 'game' && r.id === id);
    }

    function isDistributed(game) {
        return Boolean(game.felledGameDetails.meatDistribution?.trim());
    }

    function goesToSlaughterhouse(game) {
        return game.felledGameDetails.meatDistribution.toLowerCase().includes('slakteri');
    }

    // Användarinmatad text får aldrig gå via innerHTML.
    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function requireActiveHunt() {
        if (hunt.id) return true;
        showAlert(NO_ACTIVE_HUNT_MESSAGE, 'Ingen aktiv jakt');
        activateTab('adminTab');
        return false;
    }

    function huntDate() {
        const entry = HuntStore.getIndexEntry(hunt.id);
        const date = entry ? new Date(entry.dateString) : new Date();
        return Number.isNaN(date.getTime()) ? new Date() : date;
    }

    // ---------- Overlays ----------

    function openOverlay(overlay, { stack = false } = {}) {
        if (!stack) closeAllOverlays();
        overlay.classList.add('is-open');
        syncBodyOverlayClass();
    }

    function closeOverlay(overlay) {
        overlay.classList.remove('is-open');
        syncBodyOverlayClass();
    }

    function closeAllOverlays() {
        document.querySelectorAll('.content-overlay.is-open').forEach((o) => o.classList.remove('is-open'));
        syncBodyOverlayClass();
    }

    function syncBodyOverlayClass() {
        const anyOpen = document.querySelector('.content-overlay.is-open') || !dom.introVideoOverlay.hidden;
        document.body.classList.toggle('overlay-open', Boolean(anyOpen));
    }

    // Meddelanden läggs ovanpå öppna formulär så att inmatningen inte försvinner.
    function showAlert(message, title) {
        dom.customAlertHeader.hidden = !title;
        dom.customAlertTitle.textContent = title || '';
        dom.customAlertMessage.textContent = message;
        openOverlay(dom.customAlertModal, { stack: true });
        dom.customAlertOkBtn.focus();
    }

    function showConfirm(message, title, onConfirm, onCancel = null) {
        dom.customConfirmTitle.textContent = title || 'Bekräfta åtgärd';
        dom.customConfirmMessage.textContent = message;
        confirmHandlers = { onConfirm, onCancel };
        openOverlay(dom.customConfirmModal, { stack: true });
        dom.customConfirmOkBtn.focus();
    }

    function finishConfirm(confirmed) {
        const { onConfirm, onCancel } = confirmHandlers;
        confirmHandlers = { onConfirm: null, onCancel: null };
        closeOverlay(dom.customConfirmModal);
        const handler = confirmed ? onConfirm : onCancel;
        if (handler) handler();
    }

    // ---------- Flikar, tema och installation ----------

    function activateTab(tabId) {
        dom.tabContents.forEach((content) => {
            content.hidden = content.id !== tabId;
        });
        dom.tabButtons.forEach((button) => {
            button.classList.toggle('active', button.dataset.tab === tabId);
        });
    }

    function initializeTabs() {
        dom.tabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                activateTab(button.dataset.tab);
                HuntStore.setLastTab(button.dataset.tab);
            });
        });
        const lastTab = HuntStore.getLastTab();
        activateTab(lastTab && document.getElementById(lastTab) ? lastTab : 'shotTab');
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        document.body.dataset.theme = isDark ? 'dark' : 'light';
        // SVG-element saknar egenskapen hidden, så attributet sätts direkt.
        dom.themeIconSun.toggleAttribute('hidden', !isDark);
        dom.themeIconMoon.toggleAttribute('hidden', isDark);
        dom.themeToggleBtn.title = isDark ? 'Växla till ljust tema' : 'Växla till mörkt tema';
        HuntStore.setTheme(document.body.dataset.theme);

        const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary-color').trim();
        document.querySelector('meta[name=theme-color]').setAttribute('content', primaryColor);
    }

    function initialTheme() {
        const saved = HuntStore.getTheme();
        if (saved) return saved;
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function setupInstallButton() {
        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            deferredInstallPrompt = event;
            dom.installAppBtn.hidden = false;
        });
        window.addEventListener('appinstalled', () => {
            dom.installAppBtn.hidden = true;
            deferredInstallPrompt = null;
        });
        dom.installAppBtn.addEventListener('click', async () => {
            if (deferredInstallPrompt) {
                deferredInstallPrompt.prompt();
                await deferredInstallPrompt.userChoice;
                deferredInstallPrompt = null;
                dom.installAppBtn.hidden = true;
            } else if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                showAlert(
                    "För att installera på iOS: Klicka på Dela-ikonen i Safari och välj sedan 'Lägg till på hemskärmen'.",
                    'Installationsguide',
                );
            } else if (navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
                showAlert('Appen är redan installerad!', 'Information');
            } else {
                showAlert(
                    'Installationsprompt ej tillgänglig. Försök igen senare eller följ webbläsarens instruktioner för att lägga till på hemskärmen.',
                    'Information',
                );
            }
        });
    }

    // ---------- Introfilm ----------

    // Introt visas högst en gång per dag, även om jakter startas eller öppnas flera gånger.
    function playIntroIfNotShownToday() {
        const today = new Date().toDateString();
        if (HuntStore.getIntroShownDate() === today) return;

        const player = dom.introVideoPlayer;
        const finish = () => {
            player.removeEventListener('ended', finish);
            player.removeEventListener('click', skip);
            hideIntro();
            HuntStore.setIntroShownDate(today);
        };
        const skip = () => {
            player.pause();
            finish();
        };

        closeAllOverlays();
        dom.introVideoOverlay.hidden = false;
        syncBodyOverlayClass();
        player.currentTime = 0;
        player.addEventListener('ended', finish);
        player.addEventListener('click', skip);
        // Utan nät (videon cachas inte) eller om uppspelning nekas hoppar vi över introt.
        player.play().catch(() => {
            player.removeEventListener('ended', finish);
            player.removeEventListener('click', skip);
            hideIntro();
        });
    }

    function hideIntro() {
        dom.introVideoOverlay.hidden = true;
        syncBodyOverlayClass();
    }

    // ---------- Lagring av jakter ----------

    function saveHunt() {
        if (!hunt.id) return;
        const entry = HuntStore.getIndexEntry(hunt.id);
        const creationDate = entry?.dateString || new Date().toISOString();
        const saved = HuntStore.saveHunt(hunt.id, {
            reports: hunt.reports,
            nextSaaterToAssign: hunt.nextSaaterToAssign,
            saaterDisplayStates: hunt.saaterStates,
            creationDate,
        });

        const index = HuntStore.getIndex();
        const existing = index.find((e) => e.id === hunt.id);
        if (existing) {
            existing.itemCount = hunt.reports.length;
        } else {
            index.push({ id: hunt.id, dateString: creationDate, itemCount: hunt.reports.length });
        }
        const indexSaved = HuntStore.saveIndex(index);

        if ((!saved || !indexSaved) && !saveFailureShown) {
            saveFailureShown = true;
            showAlert(
                'Kunde inte spara i telefonen. Lagringen kan vara full eller avstängd (t.ex. privat surfläge).',
                'Sparning misslyckades',
            );
        }
        renderSavedHunts();
    }

    function setHuntState(huntId, data) {
        hunt.id = huntId;
        hunt.reports = data?.reports || [];
        hunt.saaterStates = data?.saaterDisplayStates || {};
        hunt.nextSaaterToAssign = data?.nextSaaterToAssign || 1;
        for (const report of hunt.reports) {
            if (Number.isFinite(report.id)) lastIssuedId = Math.max(lastIssuedId, Math.ceil(report.id));
        }
    }

    // Returnerar false om jakten finns men inte går att läsa.
    function loadHunt(huntId) {
        try {
            setHuntState(huntId, HuntStore.loadHunt(huntId));
            return true;
        } catch (error) {
            console.error('Kunde inte läsa jakten', huntId, error);
            showAlert(
                `Fel: Kunde inte läsa data för jakten (ID: ${huntId}). Den kan vara korrupt.`,
                'Laddningsfel',
            );
            return false;
        }
    }

    function activateHunt(huntId) {
        if (!loadHunt(huntId)) return false;
        HuntStore.setActiveHuntId(huntId);
        return true;
    }

    function startNewHunt() {
        setHuntState('hunt_' + nextId(), null);
        HuntStore.setActiveHuntId(hunt.id);
        saveHunt();
    }

    function activateNewestHuntOrStartNew() {
        const newest = HuntStore.getIndexNewestFirst()[0];
        if (!newest || !activateHunt(newest.id)) startNewHunt();
    }

    function loadInitialHunt() {
        const activeId = HuntStore.getActiveHuntId();
        if (!activeId) {
            startNewHunt();
        } else if (!activateHunt(activeId)) {
            activateNewestHuntOrStartNew();
        }
        renderAll();
    }

    function renderAll() {
        renderShotList();
        renderGameList();
        renderSavedHunts();
    }

    // ---------- Skott och såtar ----------

    function renderShotList() {
        dom.shotLogList.replaceChildren();
        const hasShots = shots().length > 0;
        dom.noLoggedShotsInfo.hidden = hasShots;
        // Ny såt går att trycka på så länge jakten inte bara innehåller vilt.
        dom.newSaaterBtn.disabled = hunt.reports.length > 0 && !hasShots;

        hunt.reports
            .slice()
            .sort(newestFirst)
            .forEach((item) => {
                if (item.itemType === 'saaterDivider') dom.shotLogList.appendChild(createSaaterDivider(item));
                if (item.itemType === 'shot') dom.shotLogList.appendChild(createShotItem(item));
            });
    }

    function isSaaterCollapsed(saaterNumber) {
        return hunt.saaterStates[`saater_${saaterNumber}`] === 'collapsed';
    }

    function createSaaterDivider(divider) {
        const li = createElement('li', 'saater-divider');
        li.dataset.saaterNumber = divider.saaterNumber;
        const icon = createElement('span', 'saater-toggle-icon');
        icon.classList.add(isSaaterCollapsed(divider.saaterNumber) ? 'collapsed' : 'expanded');
        li.append(
            document.createElement('hr'),
            createElement('span', 'saater-text', `Såt ${divider.saaterNumber}`),
            icon,
            document.createElement('hr'),
        );
        li.addEventListener('click', () => toggleSaater(divider.saaterNumber));
        return li;
    }

    function createShotItem(shot) {
        const li = createElement('li', 'shot-log-item');
        li.dataset.shotId = shot.id;
        li.hidden = shot.saater !== 0 && isSaaterCollapsed(shot.saater);

        const info = createElement('div', 'shot-info');
        info.title = 'Klicka för att associera/ändra association';
        info.addEventListener('click', () => openLinkShotModal(shot.id));
        info.appendChild(createElement('span', 'shot-time', `Skott kl. ${shot.shotTime}`));

        const status = createElement('span', 'shot-link-status');
        const linkedGame = shot.linkedGameReportId ? findGame(shot.linkedGameReportId) : null;
        if (linkedGame) {
            const { species, passLocation } = linkedGame.felledGameDetails;
            status.appendChild(createElement('span', 'shot-link-species', species || 'Okänt Vilt'));
            if (passLocation) status.appendChild(createElement('span', 'shot-link-location', passLocation));
        } else {
            status.textContent = shot.linkedGameReportId ? 'Associerad (vilt saknas?)' : 'Ej associerad';
        }
        info.appendChild(status);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `verify-${shot.id}`;
        checkbox.checked = shot.isVerified;
        checkbox.addEventListener('change', () => {
            shot.isVerified = checkbox.checked;
            saveHunt();
        });
        const label = createElement('label', '', 'Verifierat');
        label.htmlFor = checkbox.id;
        const verifyGroup = createElement('div', 'time-verified-group');
        verifyGroup.append(checkbox, label);

        const deleteBtn = createElement('button', 'icon-button delete-btn');
        deleteBtn.innerHTML = ICONS.trash;
        deleteBtn.title = 'Ta bort skott';
        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            deleteShot(shot.id);
        });

        const actions = createElement('div', 'shot-actions');
        actions.append(verifyGroup, deleteBtn);
        li.append(info, actions);
        return li;
    }

    function logShot() {
        if (!requireActiveHunt()) return;
        const now = new Date();
        hunt.reports.unshift({
            id: nextId(),
            itemType: 'shot',
            shotTime: formatTime(now),
            isVerified: false,
            createdAt: now.toISOString(),
            linkedGameReportId: null,
            saater: 0,
        });
        saveHunt();
        renderShotList();
    }

    // Alla skott utan såt hamnar i en ny såt, och tidigare såtar fälls ihop.
    function startNewSaater() {
        if (!requireActiveHunt()) return;
        const saaterNumber = hunt.nextSaaterToAssign;
        const unassigned = shots().filter((s) => s.saater === 0);
        unassigned.forEach((s) => (s.saater = saaterNumber));

        // Avdelaren sorteras precis ovanför såtens senaste skott.
        const anchor =
            unassigned.slice().sort(newestFirst)[0] ||
            hunt.reports.filter((r) => r.itemType === 'saaterDivider').sort(newestFirst)[0];
        const createdAt = anchor
            ? new Date(new Date(anchor.createdAt).getTime() + 1).toISOString()
            : new Date().toISOString();
        hunt.reports.unshift({ id: nextId(), itemType: 'saaterDivider', saaterNumber, createdAt });

        Object.keys(hunt.saaterStates).forEach((key) => (hunt.saaterStates[key] = 'collapsed'));
        hunt.saaterStates[`saater_${saaterNumber}`] = 'collapsed';
        hunt.nextSaaterToAssign++;

        saveHunt();
        renderShotList();
        dom.newSaaterBtn.blur();
    }

    function toggleSaater(saaterNumber) {
        const key = `saater_${saaterNumber}`;
        hunt.saaterStates[key] = hunt.saaterStates[key] === 'collapsed' ? 'expanded' : 'collapsed';
        saveHunt();
        renderShotList();
    }

    function deleteShot(shotId) {
        const shot = findShot(shotId);
        if (!shot) return;
        const message = shot.linkedGameReportId
            ? 'Detta skott är associerat med ett fällt vilt.\nVill du ta bort skottet och dess association?'
            : 'Vill du verkligen ta bort detta skott?';
        showConfirm(message, 'Bekräfta Borttagning', () => {
            const game = findGame(shot.linkedGameReportId);
            if (game) {
                game.felledGameDetails.linkedShotIds = game.felledGameDetails.linkedShotIds.filter(
                    (id) => id !== shotId,
                );
            }
            hunt.reports = hunt.reports.filter((r) => r !== shot);
            saveHunt();
            renderShotList();
            renderGameList();
        });
    }

    // ---------- Fällt vilt ----------

    function renderGameList() {
        dom.reportList.replaceChildren();
        const sortedGames = games().sort(newestFirst);
        dom.noReportsInfo.hidden = sortedGames.length > 0;

        sortedGames.forEach((game) => {
            const { species, shooter, passLocation } = game.felledGameDetails;
            const distributed = isDistributed(game);

            const li = createElement('li', 'report-item-stacked');
            li.dataset.reportId = game.id;
            li.addEventListener('click', () =>
                distributed ? openViewGameModal(game.id) : openGameForm(game.id),
            );

            const placeholder = createElement(
                'div',
                'item-image-placeholder',
                (species || 'Okänt vilt').charAt(0).toUpperCase(),
            );

            const details = createElement('div', 'details');
            details.append(
                createElement('span', '', shooter || '-'),
                createElement('span', '', passLocation || '-'),
            );
            const mainInfo = createElement('div', 'item-main-info');
            mainInfo.append(createElement('div', 'species', species || '-'), details);

            const statusClass = distributed ? 'is-distributed' : 'is-undistributed';
            const icon = createElement('div', `meat-status-icon ${statusClass}`);
            icon.innerHTML = distributed ? ICONS.check : ICONS.warning;
            const status = createElement('div', 'item-status-actions');
            status.append(
                icon,
                createElement(
                    'span',
                    `meat-status-text ${statusClass}`,
                    distributed ? 'Fördelat' : 'Ej fördelat',
                ),
            );

            li.append(placeholder, mainInfo, status);
            dom.reportList.appendChild(li);
        });
    }

    // gameId null betyder nytt vilt. linkShotId kopplas till det nya viltet när det sparas.
    function openGameForm(gameId, linkShotId = null) {
        if (!requireActiveHunt()) return;
        const game = gameId === null ? null : findGame(gameId);
        if (gameId !== null && !game) {
            showAlert('Fel: Hittade inte viltrapport för redigering.', 'Fel');
            return;
        }

        const details = game?.felledGameDetails || {};
        dom.addGameModal.dataset.gameId = game ? game.id : '';
        dom.addGameModal.dataset.linkShotId = linkShotId ?? '';
        dom.gameModalTitle.textContent = game ? 'Redigera Fällt Vilt' : 'Lägg till fällt vilt';
        dom.gameSpeciesInput.value = details.species || '';
        dom.gameShooterInput.value = details.shooter || '';
        dom.gamePassLocationInput.value = details.passLocation || '';
        dom.gameReportTimeInput.value = game ? details.reportTime || '' : formatTime(new Date());
        dom.gameMeatDistributionTextarea.value = details.meatDistribution || '';
        dom.meatRecipientNameInput.value = '';
        dom.deleteGameFromEditModalBtn.hidden = !game;
        dom.addGameModal.querySelector('.overlay-scrollable-content').scrollTop = 0;

        openOverlay(dom.addGameModal);
        dom.gameSpeciesInput.focus();
    }

    function saveGameForm() {
        if (!requireActiveHunt()) return;
        if (!dom.gameSpeciesInput.value) {
            showAlert('Välj ett viltslag.', 'Obligatoriskt fält');
            dom.gameSpeciesInput.focus();
            return;
        }
        if (!dom.gameReportTimeInput.value) {
            showAlert('Ange tid för rapport/hantering.', 'Obligatoriskt fält');
            dom.gameReportTimeInput.focus();
            return;
        }

        const details = {
            species: dom.gameSpeciesInput.value,
            passLocation: dom.gamePassLocationInput.value.trim(),
            shooter: dom.gameShooterInput.value.trim(),
            reportTime: dom.gameReportTimeInput.value,
            meatDistribution: dom.gameMeatDistributionTextarea.value.trim(),
        };

        const editId = dom.addGameModal.dataset.gameId;
        if (editId) {
            const game = findGame(Number(editId));
            if (!game) {
                showAlert('Fel: Kunde inte hitta viltrapporten att spara till.', 'Fel');
                closeOverlay(dom.addGameModal);
                return;
            }
            game.felledGameDetails = { ...game.felledGameDetails, ...details };
        } else {
            const game = {
                id: nextId(),
                itemType: 'game',
                createdAt: new Date().toISOString(),
                felledGameDetails: { ...details, linkedShotIds: [] },
            };
            hunt.reports.unshift(game);
            const linkShotId = Number(dom.addGameModal.dataset.linkShotId);
            if (linkShotId) linkShotToGame(linkShotId, game.id);
        }

        saveHunt();
        renderShotList();
        renderGameList();
        closeOverlay(dom.addGameModal);
    }

    function deleteGame(gameId) {
        const game = findGame(gameId);
        if (!game) return;
        const linkedShotIds = game.felledGameDetails.linkedShotIds || [];
        const message = linkedShotIds.length
            ? 'Detta fällda vilt har associerade skott.\nVill du ta bort viltet och alla associationer till det?'
            : 'Vill du verkligen ta bort detta fällda vilt?';
        showConfirm(message, 'Bekräfta Borttagning', () => {
            linkedShotIds.forEach((shotId) => {
                const shot = findShot(shotId);
                if (shot) shot.linkedGameReportId = null;
            });
            hunt.reports = hunt.reports.filter((r) => r !== game);
            saveHunt();
            renderShotList();
            renderGameList();
        });
    }

    function openViewGameModal(gameId) {
        const game = findGame(gameId);
        if (!game) return;
        viewedGameId = gameId;
        const { species, shooter, passLocation, reportTime, meatDistribution } = game.felledGameDetails;
        const speciesName = species || 'Okänt Vilt';

        dom.viewGameTitleIcon.textContent = speciesName.charAt(0).toUpperCase();
        dom.viewGameTitleText.textContent = speciesName;
        dom.viewGameSpecies.textContent = species || '-';
        dom.viewGameShooter.textContent = shooter || '-';
        dom.viewGamePassLocation.textContent = passLocation || '-';
        dom.viewGameReportTime.textContent = reportTime || '-';

        const distributed = isDistributed(game);
        const statusClass = distributed ? 'is-distributed' : 'is-undistributed';
        dom.viewMeatStatusIcon.className = statusClass;
        dom.viewMeatStatusIcon.innerHTML = distributed ? ICONS.check : ICONS.warning;
        dom.viewMeatDistributionText.className = statusClass;
        dom.viewMeatDistributionText.textContent = distributed ? meatDistribution : 'Ej fördelat';

        dom.viewLinkedShotsList.replaceChildren();
        const linkedShotIds = game.felledGameDetails.linkedShotIds || [];
        if (linkedShotIds.length === 0) {
            dom.viewLinkedShotsList.appendChild(
                createElement('li', 'info-text', 'Inga skott registrerade mot detta vilt.'),
            );
        }
        linkedShotIds.forEach((shotId) => {
            const shot = findShot(shotId);
            const text = shot
                ? `Skott kl. ${shot.shotTime}${shot.saater > 0 ? `, Såt ${shot.saater}` : ''}`
                : `Skott ID: ${shotId} (Data saknas?)`;
            dom.viewLinkedShotsList.appendChild(createElement('li', shot ? '' : 'linked-shot-missing', text));
        });

        openOverlay(dom.viewGameModal);
    }

    // ---------- Koppling skott och vilt ----------

    function openLinkShotModal(shotId) {
        if (!requireActiveHunt()) return;
        const shot = findShot(shotId);
        if (!shot) {
            showAlert('Fel: Skottet kunde inte hittas.', 'Fel');
            return;
        }
        dom.linkShotModal.dataset.shotId = shotId;
        dom.unlinkShotBtn.hidden = !shot.linkedGameReportId;
        dom.cancelLinkActionBtn.hidden = Boolean(shot.linkedGameReportId);

        dom.linkableGameList.replaceChildren();
        const sortedGames = games().sort(newestFirst);
        if (sortedGames.length === 0) {
            dom.linkableGameList.appendChild(
                createElement('li', 'info-text', 'Inget fällt vilt att associera till ännu.'),
            );
        }
        sortedGames.forEach((game) => {
            const { species, shooter, passLocation } = game.felledGameDetails;
            const li = createElement('li', 'linkable-game-item');
            li.dataset.gameId = game.id;
            li.append(
                createElement('span', 'species', species || 'Okänt Vilt'),
                createElement('span', 'details', `Skytt: ${shooter || '-'}, Plats: ${passLocation || '-'}`),
            );
            li.addEventListener('click', () => {
                linkShotToGame(shotId, game.id);
                saveHunt();
                renderShotList();
                renderGameList();
                closeOverlay(dom.linkShotModal);
            });
            dom.linkableGameList.appendChild(li);
        });

        openOverlay(dom.linkShotModal);
    }

    // Ett skott hör till högst ett vilt; en tidigare koppling tas bort.
    function linkShotToGame(shotId, gameId) {
        const shot = findShot(shotId);
        const game = findGame(gameId);
        if (!shot || !game) {
            showAlert('Kunde inte utföra associationen.', 'Fel');
            return;
        }
        games().forEach((g) => {
            if (g !== game && g.felledGameDetails.linkedShotIds?.includes(shotId)) {
                g.felledGameDetails.linkedShotIds = g.felledGameDetails.linkedShotIds.filter(
                    (id) => id !== shotId,
                );
            }
        });
        shot.linkedGameReportId = gameId;
        game.felledGameDetails.linkedShotIds ||= [];
        if (!game.felledGameDetails.linkedShotIds.includes(shotId)) {
            game.felledGameDetails.linkedShotIds.push(shotId);
        }
    }

    function unlinkShot(shotId) {
        const shot = findShot(shotId);
        if (!shot) return;
        const game = findGame(shot.linkedGameReportId);
        if (game?.felledGameDetails.linkedShotIds) {
            game.felledGameDetails.linkedShotIds = game.felledGameDetails.linkedShotIds.filter(
                (id) => id !== shotId,
            );
        }
        shot.linkedGameReportId = null;
        saveHunt();
        renderShotList();
        renderGameList();
        closeOverlay(dom.linkShotModal);
    }

    // ---------- Köttfördelning ----------

    // Mottagarens namn och vald mall slås ihop till fördelningstexten.
    // Byts namnet ut ersätts det gamla namnet framför mallen.
    function updateMeatDistributionText(selectedTemplate) {
        const nameInput = dom.meatRecipientNameInput;
        const textarea = dom.gameMeatDistributionTextarea;
        const recipient = nameInput.value.trim();
        const current = textarea.value.trim();
        const previousRecipient = nameInput.dataset.previousRecipient || '';
        const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

        if (selectedTemplate) {
            textarea.value = recipient ? `${recipient} ${selectedTemplate}` : capitalize(selectedTemplate);
            return;
        }

        if (recipient) {
            const template = MEAT_TEMPLATES.find(
                (t) =>
                    current === t ||
                    (current.endsWith(' ' + t) && current.slice(0, current.length - t.length - 1).trim()),
            );
            if (template) {
                textarea.value = `${recipient} ${template}`;
            } else if (
                current === '' ||
                current === previousRecipient ||
                !current.toLowerCase().startsWith(recipient.toLowerCase())
            ) {
                textarea.value = recipient;
            }
            nameInput.dataset.previousRecipient = recipient;
            return;
        }

        // Namnet har tömts: ta bort det gamla namnet ur texten.
        const template = MEAT_TEMPLATES.find(
            (t) =>
                current === t ||
                (current.endsWith(' ' + t) &&
                    current.slice(0, current.length - t.length - 1).trim() === previousRecipient),
        );
        if (template) {
            textarea.value = capitalize(template);
        } else if (previousRecipient && textarea.value.startsWith(previousRecipient + ' ')) {
            textarea.value = textarea.value.slice(previousRecipient.length + 1);
        } else if (previousRecipient && textarea.value === previousRecipient) {
            textarea.value = '';
        }
        nameInput.dataset.previousRecipient = '';
    }

    function populateQuickChoices() {
        MEAT_TEMPLATES.forEach((template) => {
            const li = createElement('li', '', template);
            li.addEventListener('click', () => {
                updateMeatDistributionText(template);
                closeOverlay(dom.quickChoiceModal);
            });
            dom.quickChoiceList.appendChild(li);
        });
    }

    // Vilt med fördelat kött, grupperat på slakteri eller annan plats.
    function meatReportGroups() {
        const bySpeciesThenText = (a, b) =>
            (a.felledGameDetails.species || '').localeCompare(b.felledGameDetails.species || '', 'sv') ||
            a.felledGameDetails.meatDistribution.localeCompare(b.felledGameDetails.meatDistribution, 'sv');
        const distributed = games().filter(isDistributed);
        return [
            {
                name: 'Till slakteriet',
                items: distributed.filter(goesToSlaughterhouse).sort(bySpeciesThenText),
            },
            {
                name: 'Till annan plats',
                items: distributed.filter((g) => !goesToSlaughterhouse(g)).sort(bySpeciesThenText),
            },
        ].filter((group) => group.items.length > 0);
    }

    function openMeatReport() {
        const groups = meatReportGroups();
        dom.reportDateDisplay.textContent = `Jakt: ${formatDate(huntDate())}`;
        dom.noMeatDistributionReportsInfo.hidden = groups.length > 0;
        dom.meatDistributionReportList.replaceChildren();

        groups.forEach((group) => {
            dom.meatDistributionReportList.appendChild(createElement('li', 'meat-group-header', group.name));
            group.items.forEach((game) => {
                const li = createElement('li', 'meat-item');
                li.append(
                    createElement(
                        'span',
                        'meat-item-species',
                        game.felledGameDetails.species || 'Okänt vilt',
                    ),
                    document.createTextNode(': '),
                    createElement('span', 'meat-item-text', game.felledGameDetails.meatDistribution),
                );
                dom.meatDistributionReportList.appendChild(li);
            });
        });

        openOverlay(dom.saveReportOverlay);
    }

    function meatReportText() {
        const groups = meatReportGroups();
        const lines = [`Jakt: ${formatDate(huntDate())}`, ''];
        if (groups.length === 0) lines.push('Ingen köttfördelning rapporterad ännu.');
        groups.forEach((group, i) => {
            if (i > 0) lines.push('');
            lines.push(`${group.name}:`);
            group.items.forEach((game) => {
                lines.push(
                    `${game.felledGameDetails.species || 'Okänt vilt'}: ${game.felledGameDetails.meatDistribution}`,
                );
            });
        });
        return lines.join('\n');
    }

    async function copyMeatReport() {
        const text = meatReportText();
        try {
            await navigator.clipboard.writeText(text);
            showAlert('Rapporttext kopierad till urklipp!', 'Kopierat');
        } catch (error) {
            console.error('Kunde inte kopiera text', error);
            showAlert('Kopiering misslyckades. Prova manuellt eller dela direkt.', 'Fel vid kopiering');
        }
    }

    async function shareMeatReport() {
        if (!navigator.share) {
            showAlert(
                'Webbläsaren stödjer inte direkt delning. Använd "Kopiera text"-knappen och klistra in manuellt.',
                'Information',
            );
            return;
        }
        try {
            await navigator.share({ title: 'Rapport köttfördelning', text: meatReportText() });
        } catch (error) {
            if (error.name !== 'AbortError') {
                showAlert('Delning misslyckades. Du kan försöka kopiera texten istället.', 'Fel vid delning');
            }
        }
    }

    // ---------- CSV-export ----------

    // Semikolon och BOM så att svensk Excel delar upp kolumnerna och visar åäö rätt.
    function exportCsv() {
        const gameReports = games().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        if (gameReports.length === 0) {
            showAlert('Ingen data om fällt vilt att exportera för den aktiva jakten.', 'Information');
            return;
        }

        const toRow = (fields) => fields.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(';') + '\r\n';
        let csv = toRow([
            'Datum',
            'Tid',
            'Viltslag',
            'Skytt',
            'Pass/Plats',
            'Såt',
            'Köttfördelning',
            'Antal Skott',
        ]);

        gameReports.forEach((game) => {
            const details = game.felledGameDetails;
            const linkedShotIds = details.linkedShotIds || [];
            const saaterNumbers = linkedShotIds.map((id) => findShot(id)?.saater).filter((n) => n > 0);
            let saater = '';
            if (linkedShotIds.length > 0) {
                saater = saaterNumbers.length > 0 ? `Såt ${Math.min(...saaterNumbers)}` : 'Ej angivet';
            }
            csv += toRow([
                formatDate(new Date(game.createdAt)),
                details.reportTime || '',
                details.species || '',
                details.shooter || '',
                details.passLocation || '',
                saater,
                details.meatDistribution || '',
                linkedShotIds.length,
            ]);
        });

        const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `Vilt_Rapport_Jakt_${formatDate(huntDate()).replace(/-/g, '')}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    // ---------- Sparade jakter ----------

    function renderSavedHunts() {
        const index = HuntStore.getIndexNewestFirst();
        dom.savedHuntsList.replaceChildren();
        dom.noSavedHuntsInfo.hidden = index.length > 0;

        index.forEach((entry) => {
            const isActive = entry.id === hunt.id;
            const li = createElement('li', 'saved-hunt-item');
            li.classList.toggle('is-active', isActive);
            li.dataset.huntId = entry.id;

            const date = new Date(entry.dateString);
            const dateText = Number.isNaN(date.getTime())
                ? 'Ogiltigt datum'
                : date.toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });

            const loadBtn = createElement(
                'button',
                `button-secondary ${isActive ? 'load-hunt-active-btn' : 'load-hunt-btn'}`,
                isActive ? 'Aktiv Jakt' : 'Öppna Jakt',
            );
            loadBtn.disabled = isActive;
            loadBtn.addEventListener('click', () => openSavedHunt(entry.id));

            const deleteBtn = createElement('button', 'icon-button delete-hunt-btn delete-btn');
            deleteBtn.innerHTML = ICONS.trash;
            deleteBtn.title = 'Ta bort denna jakt';
            deleteBtn.addEventListener('click', () => deleteSavedHunt(entry.id));

            const actions = createElement('div', 'hunt-actions');
            actions.append(loadBtn, deleteBtn);
            li.append(createElement('span', 'hunt-date', `Jakt: ${dateText}`), actions);
            dom.savedHuntsList.appendChild(li);
        });
    }

    function handleStartNewHunt() {
        saveHunt();
        startNewHunt();
        renderAll();
        playIntroIfNotShownToday();
        activateTab('shotTab');
    }

    function openSavedHunt(huntId) {
        if (huntId === hunt.id) return;
        saveHunt();
        if (!activateHunt(huntId)) return;
        renderAll();
        playIntroIfNotShownToday();
        activateTab('shotTab');
    }

    function deleteSavedHunt(huntId) {
        const entry = HuntStore.getIndexEntry(huntId);
        const dateText = entry ? new Date(entry.dateString).toLocaleDateString('sv-SE') : 'Okänt datum';
        showConfirm(
            `Är du säker på att du vill ta bort jakten från ${dateText}?\nDetta kan inte ångras.`,
            'Ta bort Sparad Jakt',
            () => {
                HuntStore.deleteHunt(huntId);
                HuntStore.saveIndex(HuntStore.getIndex().filter((e) => e.id !== huntId));
                if (huntId === hunt.id) {
                    hunt.id = null;
                    activateNewestHuntOrStartNew();
                }
                renderAll();
                showAlert(`Jakten från ${dateText} har tagits bort.`, 'Borttagen');
            },
        );
    }

    function clearAllData() {
        showConfirm(
            'Är du helt säker på att du vill radera ALLA sparade jakter och all aktiv data?\nDetta kan ABSOLUT INTE ångras!',
            'VARNING: Rensa All Data',
            () => {
                HuntStore.deleteAllHunts();
                startNewHunt();
                renderAll();
                playIntroIfNotShownToday();
                activateTab('shotTab');
            },
        );
    }

    // ---------- Dela appen ----------

    function openShareOverlay() {
        dom.qrCodeContainer.replaceChildren();
        dom.shareableLink.href = APP_URL;
        dom.shareableLink.textContent = APP_URL;
        if (typeof QRious === 'undefined') {
            dom.qrCodeContainer.textContent = 'QR-kod kunde inte laddas.';
        } else {
            const canvas = document.createElement('canvas');
            new QRious({ element: canvas, value: APP_URL, size: 188, padding: 5, level: 'H' });
            dom.qrCodeContainer.appendChild(canvas);
        }
        openOverlay(dom.shareOverlay);
    }

    // ---------- Start ----------

    function bindElements() {
        document.querySelectorAll('[id]').forEach((element) => {
            dom[element.id] = element;
        });
        dom.tabButtons = document.querySelectorAll('.tab-button');
        dom.tabContents = document.querySelectorAll('.tab-content');
    }

    function bindEvents() {
        const on = (element, handler) => element.addEventListener('click', handler);

        on(dom.themeToggleBtn, () => applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'));
        on(dom.helpBtn, () => openOverlay(dom.helpOverlay));
        on(dom.shareBtn, openShareOverlay);

        on(dom.logShotBtn, logShot);
        on(dom.newSaaterBtn, startNewSaater);

        on(dom.addFelledGameBtn, () => openGameForm(null));
        on(dom.saveGameDetailsBtn, saveGameForm);
        on(dom.cancelGameModalBtn, () => closeOverlay(dom.addGameModal));
        on(dom.deleteGameFromEditModalBtn, () => {
            closeOverlay(dom.addGameModal);
            deleteGame(Number(dom.addGameModal.dataset.gameId));
        });
        on(dom.openQuickChoiceModalBtn, () => openOverlay(dom.quickChoiceModal, { stack: true }));
        on(dom.closeQuickChoiceModalBtn, () => closeOverlay(dom.quickChoiceModal));
        on(dom.cancelQuickChoiceModalBtn, () => closeOverlay(dom.quickChoiceModal));
        dom.meatRecipientNameInput.addEventListener('input', () => updateMeatDistributionText(null));

        on(dom.createNewGameFromLinkBtn, () => openGameForm(null, Number(dom.linkShotModal.dataset.shotId)));
        on(dom.unlinkShotBtn, () => unlinkShot(Number(dom.linkShotModal.dataset.shotId)));
        on(dom.cancelLinkActionBtn, () => closeOverlay(dom.linkShotModal));
        on(dom.cancelLinkShotModalBtn, () => closeOverlay(dom.linkShotModal));

        on(dom.viewGameCloseBtn, () => closeOverlay(dom.viewGameModal));
        on(dom.viewGameEditBtn, () => openGameForm(viewedGameId));
        on(dom.viewGameDeleteBtn, () => {
            closeOverlay(dom.viewGameModal);
            deleteGame(viewedGameId);
        });

        on(dom.viewMeatReportBtn, openMeatReport);
        on(dom.saveReportOverlayCloseBtn, () => closeOverlay(dom.saveReportOverlay));
        on(dom.copyMeatReportBtn, copyMeatReport);
        on(dom.shareMeatReportBtn, shareMeatReport);
        on(dom.exportFullGameReportBtn, exportCsv);

        on(dom.startNewHuntBtn, handleStartNewHunt);
        on(dom.dangerZoneClearAllBtn, clearAllData);

        on(dom.helpOverlayCloseBtn, () => closeOverlay(dom.helpOverlay));
        on(dom.shareOverlayCloseBtn, () => closeOverlay(dom.shareOverlay));
        on(dom.customAlertOkBtn, () => closeOverlay(dom.customAlertModal));
        on(dom.customConfirmOkBtn, () => finishConfirm(true));
        on(dom.customConfirmCancelBtn, () => finishConfirm(false));
    }

    bindElements();
    applyTheme(initialTheme());
    initializeTabs();
    loadInitialHunt();
    populateQuickChoices();
    bindEvents();
    setupInstallButton();
    playIntroIfNotShownToday();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch((error) => console.error('Service worker:', error));
    }
})();
