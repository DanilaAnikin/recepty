"use client";

import {
  AlertTriangle,
  Check,
  CloudDownload,
  Database,
  Download,
  HardDrive,
  History,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { exportStateToJson, normalizeState, type AppState } from "@/lib/domain";
import * as mutations from "@/lib/mutations";
import {
  listBackups,
  restoreBackup,
  storageEstimate,
  storageKind,
  type StoredBackup,
} from "@/lib/storage";
import { forcePush, syncNow, type SyncOutcome } from "@/lib/sync";
import { useAppState } from "@/components/app/app-state";
import { useToast } from "@/components/app/toast";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/primitives";
import { formatFileSize } from "@/lib/images";

/**
 * Správa dat: záloha do souboru, automatické snapshoty, stav úložiště
 * a volitelná synchronizace na vlastní server.
 */
export function DataDialog({ onClose }: { onClose: () => void }) {
  const { state, commit, replaceState } = useAppState();
  const { showToast } = useToast();

  const importInputRef = useRef<HTMLInputElement>(null);
  const [backups, setBackups] = useState<StoredBackup[]>([]);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<StoredBackup | null>(null);
  const [pendingImport, setPendingImport] = useState<AppState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [conflict, setConflict] = useState<Extract<SyncOutcome, { status: "conflict" }> | null>(null);

  useEffect(() => {
    void listBackups().then(setBackups);
    void storageEstimate().then(setEstimate);
  }, []);

  const handleExport = () => {
    const json = exportStateToJson(state);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recepty-terinky-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    commit((current) => mutations.markBackupTaken(current), "Záloha", { track: false });
    showToast("Záloha stažena.");
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = normalizeState(JSON.parse(text));
      // Import přepisuje úplně všechno — potvrzení je tu na místě.
      setPendingImport(parsed);
    } catch {
      showToast("Soubor se nepodařilo přečíst.", { tone: "danger" });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const outcome = await syncNow(state, state.sync);
      applySyncOutcome(outcome);
    } finally {
      setSyncing(false);
    }
  };

  const applySyncOutcome = (outcome: SyncOutcome) => {
    switch (outcome.status) {
      case "disabled":
        showToast("Nejdřív zapni synchronizaci a vyplň adresu.", { tone: "danger" });
        break;
      case "in-sync":
        commit(
          (current) =>
            mutations.setSyncSettings(current, {
              lastSyncedAt: new Date().toISOString(),
              lastSyncedRevision: outcome.revision,
            }),
          "Synchronizace",
          { track: false },
        );
        showToast("Všechno je synchronizované.");
        break;
      case "pushed":
        commit(
          (current) =>
            mutations.setSyncSettings(current, {
              lastSyncedAt: new Date().toISOString(),
              lastSyncedRevision: outcome.revision,
            }),
          "Synchronizace",
          { track: false },
        );
        showToast("Data odeslána na server.");
        break;
      case "pulled":
        replaceState(
          {
            ...outcome.state,
            // Nastavení syncu je věc tohoto zařízení, ze serveru se nepřebírá.
            sync: {
              ...state.sync,
              lastSyncedAt: new Date().toISOString(),
              lastSyncedRevision: outcome.revision,
            },
          },
          "Stažení ze serveru",
        );
        showToast("Data stažena ze serveru.");
        break;
      case "conflict":
        setConflict(outcome);
        break;
      case "error":
        showToast(outcome.message, { tone: "danger" });
        break;
    }
  };

  const storageLabel =
    storageKind() === "indexeddb"
      ? "IndexedDB"
      : storageKind() === "localstorage"
        ? "localStorage (záložní režim)"
        : "paměť";

  return (
    <>
      <Modal
        title="Data a zálohy"
        onClose={onClose}
        size="wide"
        footer={
          <button type="button" className="secondary-button" onClick={onClose}>
            Zavřít
          </button>
        }
      >
        <div className="content-stack">
          <section className="form-card">
            <h4>
              <Download size={17} aria-hidden="true" /> Záloha do souboru
            </h4>
            <p className="muted-copy small">
              Jediná záloha, která přežije i smazání dat prohlížeče. Ulož si ji
              čas od času někam do cloudu.
            </p>
            {state.lastBackupAt ? (
              <p className="muted-copy small">
                Naposledy staženo {new Date(state.lastBackupAt).toLocaleDateString("cs-CZ")}.
              </p>
            ) : (
              <p className="muted-copy small warning-copy">
                <AlertTriangle size={13} aria-hidden="true" /> Zálohu sis ještě nikdy nestáhla.
              </p>
            )}

            <div className="backup-actions">
              <button type="button" className="primary-button" onClick={handleExport}>
                <Download size={16} aria-hidden="true" />
                Stáhnout zálohu
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload size={16} aria-hidden="true" />
                Nahrát zálohu
              </button>
            </div>

            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="backup-file-input"
              onChange={(event) => {
                const input = event.target;
                const file = input.files?.[0];
                if (file) {
                  void handleImportFile(file).finally(() => {
                    input.value = "";
                  });
                }
              }}
            />
          </section>

          <section className="form-card">
            <h4>
              <History size={17} aria-hidden="true" /> Automatické snapshoty
            </h4>
            <p className="muted-copy small">
              Aplikace si sama drží posledních pár verzí dat pro případ, že se
              něco pokazí. Zůstávají v tomhle prohlížeči.
            </p>
            {backups.length === 0 ? (
              <p className="muted-copy small">Zatím žádný snapshot.</p>
            ) : (
              <ul className="backup-list">
                {backups.map((backup) => (
                  <li key={backup.id}>
                    <span>
                      {new Date(backup.createdAt).toLocaleString("cs-CZ")}
                      <span className="muted-copy small">
                        {backup.state.recipes.length} receptů
                      </span>
                    </span>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setPendingRestore(backup)}
                    >
                      Obnovit
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="form-card">
            <h4>
              <RefreshCw size={17} aria-hidden="true" /> Synchronizace mezi zařízeními
            </h4>
            <p className="muted-copy small">
              Bez tohohle žijí data jen v jednom prohlížeči. Endpoint běží spolu
              s aplikací na <code>/api/sync</code>; na serveru je potřeba nastavit
              proměnnou <code>SYNC_TOKEN</code> a stejný token vyplnit sem.
            </p>

            <label className="checkbox-row standalone">
              <input
                type="checkbox"
                checked={state.sync.enabled}
                onChange={(event) =>
                  commit(
                    (current) => mutations.setSyncSettings(current, { enabled: event.target.checked }),
                    "Nastavení synchronizace",
                    { track: false },
                  )
                }
              />
              <span>Zapnout synchronizaci</span>
            </label>

            {state.sync.enabled ? (
              <>
                <label className="field-stack">
                  <span>Adresa endpointu</span>
                  <input
                    value={state.sync.endpoint}
                    placeholder="/api/sync"
                    onChange={(event) =>
                      commit(
                        (current) =>
                          mutations.setSyncSettings(current, { endpoint: event.target.value }),
                        "Nastavení synchronizace",
                        { track: false },
                      )
                    }
                  />
                </label>

                <label className="field-stack">
                  <span>Token</span>
                  <input
                    type="password"
                    value={state.sync.token}
                    autoComplete="off"
                    onChange={(event) =>
                      commit(
                        (current) => mutations.setSyncSettings(current, { token: event.target.value }),
                        "Nastavení synchronizace",
                        { track: false },
                      )
                    }
                  />
                </label>

                <div className="backup-actions">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={syncing}
                    onClick={() => void handleSync()}
                  >
                    {syncing ? (
                      <>
                        <Loader2 size={16} className="spin" aria-hidden="true" />
                        Synchronizuji…
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} aria-hidden="true" />
                        Synchronizovat teď
                      </>
                    )}
                  </button>
                </div>

                {state.sync.lastSyncedAt ? (
                  <p className="muted-copy small">
                    Naposledy {new Date(state.sync.lastSyncedAt).toLocaleString("cs-CZ")}.
                  </p>
                ) : null}
              </>
            ) : null}
          </section>

          <section className="form-card">
            <h4>
              <HardDrive size={17} aria-hidden="true" /> Úložiště
            </h4>
            <p className="muted-copy small">
              Data se ukládají do <strong>{storageLabel}</strong>. Fotky jdou zvlášť
              jako binárky, takže nezabírají místo v hlavním záznamu.
            </p>
            {estimate && estimate.quota > 0 ? (
              <>
                <div className="storage-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (estimate.usage / estimate.quota) * 100)}%` }} />
                </div>
                <p className="muted-copy small">
                  Zabráno {formatFileSize(estimate.usage)} z {formatFileSize(estimate.quota)}.
                </p>
              </>
            ) : null}
            <p className="muted-copy small">
              <Database size={13} aria-hidden="true" /> {state.recipes.length} receptů,{" "}
              {state.ingredients.length} ingrediencí, {state.pantry.length} položek ve spíži.
            </p>
          </section>
        </div>
      </Modal>

      {pendingRestore ? (
        <ConfirmDialog
          title="Obnovit snapshot?"
          message={`Aktuální data se nahradí verzí z ${new Date(pendingRestore.createdAt).toLocaleString("cs-CZ")}. Půjde to vzít zpět.`}
          confirmLabel="Obnovit"
          onCancel={() => setPendingRestore(null)}
          onConfirm={() => {
            void restoreBackup(pendingRestore.id).then((restored) => {
              if (restored) {
                replaceState(restored, "Obnovení snapshotu");
                showToast("Snapshot obnoven.");
              } else {
                showToast("Snapshot se nepodařilo načíst.", { tone: "danger" });
              }
              setPendingRestore(null);
            });
          }}
        />
      ) : null}

      {pendingImport ? (
        <ConfirmDialog
          title="Nahrát zálohu?"
          message={`Záloha obsahuje ${pendingImport.recipes.length} receptů a ${pendingImport.ingredients.length} ingrediencí. Nahradí všechna současná data. Půjde to vzít zpět.`}
          confirmLabel="Nahrát"
          onCancel={() => setPendingImport(null)}
          onConfirm={() => {
            replaceState(pendingImport, "Import zálohy");
            setPendingImport(null);
            showToast("Záloha nahrána.");
          }}
        />
      ) : null}

      {conflict ? (
        <Modal
          title="Data se rozešla"
          onClose={() => setConflict(null)}
          footer={
            <button type="button" className="secondary-button" onClick={() => setConflict(null)}>
              Rozhodnu se později
            </button>
          }
        >
          <div className="content-stack compact">
            <p className="confirm-message">
              Od poslední synchronizace se změnilo tohle zařízení i server. Slít to
              automaticky by nadělalo víc škody než užitku — vyber, která verze platí.
            </p>

            <div className="conflict-choice">
              <div>
                <strong>Tohle zařízení</strong>
                <p className="muted-copy small">
                  {state.recipes.length} receptů, změněno{" "}
                  {new Date(state.updatedAt).toLocaleString("cs-CZ")}
                </p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    void forcePush(state, state.sync).then((outcome) => {
                      applySyncOutcome(outcome);
                      setConflict(null);
                    });
                  }}
                >
                  <CloudDownload size={16} aria-hidden="true" />
                  Přepsat server
                </button>
              </div>

              <div>
                <strong>Server</strong>
                <p className="muted-copy small">
                  {conflict.remoteState.recipes.length} receptů, změněno{" "}
                  {new Date(conflict.remoteUpdatedAt).toLocaleString("cs-CZ")}
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    replaceState(
                      {
                        ...conflict.remoteState,
                        sync: {
                          ...state.sync,
                          lastSyncedAt: new Date().toISOString(),
                          lastSyncedRevision: conflict.remoteRevision,
                        },
                      },
                      "Převzetí ze serveru",
                    );
                    setConflict(null);
                    showToast("Převzata verze ze serveru.");
                  }}
                >
                  <Check size={16} aria-hidden="true" />
                  Převzít server
                </button>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
