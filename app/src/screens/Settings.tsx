import { AppHeader } from "../components/AppHeader";
import { Body } from "../components/PhoneFrame";
import { SubBar } from "../components/SubBar";
import { useStore } from "../store";
import { CURRENT_EMPLOYEE } from "../lib/mockData";
import { WifiOffIcon } from "../components/icons";

export function Settings() {
  const isOffline = useStore((s) => s.isOffline);
  const toggleOffline = useStore((s) => s.toggleOffline);
  const queue = useStore((s) => s.queue);
  const resetDemoData = useStore((s) => s.resetDemoData);
  const drainQueue = useStore((s) => s.drainQueue);

  return (
    <>
      <AppHeader />
      <SubBar title="Settings" />
      <Body>
        <section className="px-3.5 pt-3">
          <SectionLabel>Account</SectionLabel>
          <div className="bg-white rounded-xl p-3.5 border border-gray-200">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Signed in as
            </div>
            <div className="text-[15px] font-extrabold text-navy mt-1">
              {CURRENT_EMPLOYEE.displayName}
            </div>
            <div className="text-xs text-gray-700 mt-0.5">{CURRENT_EMPLOYEE.email}</div>
            <div className="text-[11px] text-gray-500 mt-2">
              Resource: <span className="font-bold text-navy">{CURRENT_EMPLOYEE.bcResourceNo}</span>{" "}
              · Role: <span className="font-bold text-navy">{CURRENT_EMPLOYEE.role}</span>
            </div>
          </div>
        </section>

        <section className="px-3.5 mt-4">
          <SectionLabel>Connection</SectionLabel>
          <button
            onClick={toggleOffline}
            className={`w-full text-left rounded-xl p-3.5 border flex items-start gap-3 ${
              isOffline
                ? "bg-[#fff8e1] border-[#fde68a]"
                : "bg-white border-gray-200"
            }`}
          >
            <div
              className={`w-[36px] h-[36px] rounded-lg flex items-center justify-center shrink-0 ${
                isOffline ? "bg-[#fde68a] text-[#92400e]" : "bg-navy-bg text-navy"
              }`}
            >
              <WifiOffIcon />
            </div>
            <div className="flex-1">
              <div className={`text-[13px] font-extrabold ${isOffline ? "text-[#92400e]" : "text-navy"}`}>
                {isOffline ? "Currently Offline" : "Online · Connected"}
              </div>
              <div className={`text-[11px] mt-1 ${isOffline ? "text-[#92400e]" : "text-gray-500"}`}>
                {isOffline
                  ? `${queue.length} item${queue.length === 1 ? "" : "s"} waiting to sync. Tap to go back online.`
                  : "Tap to simulate going offline. Punches & photos will queue locally."}
              </div>
            </div>
          </button>

          {queue.length > 0 && !isOffline && (
            <button
              onClick={drainQueue}
              className="w-full mt-2 h-11 rounded-[10px] bg-navy hover:bg-navy-light text-white font-bold text-sm"
            >
              Sync {queue.length} pending item{queue.length === 1 ? "" : "s"}
            </button>
          )}
        </section>

        <section className="px-3.5 mt-4">
          <SectionLabel>Prototype</SectionLabel>
          <div className="bg-white rounded-xl p-3.5 border border-gray-200">
            <div className="text-[13px] font-bold text-navy">This is a working prototype</div>
            <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              All data lives in <code className="bg-gray-100 px-1 rounded text-navy">localStorage</code> on
              this device. No real Business Central, Dataverse, SharePoint, or Entra ID connection
              yet. Photos are stored as base64 thumbnails in the browser.
            </div>
            <button
              onClick={() => {
                if (confirm("Reset all demo data? This clears punches, photos, edit requests, and the queue.")) {
                  resetDemoData();
                }
              }}
              className="w-full mt-3 h-11 rounded-[10px] bg-gray-100 hover:bg-gray-200 text-navy font-bold text-sm border border-gray-200"
            >
              Reset Demo Data
            </button>
          </div>
        </section>

        <section className="px-3.5 mt-4 pb-4">
          <SectionLabel>About</SectionLabel>
          <div className="text-[11px] text-gray-500 leading-relaxed px-1">
            Lumineo Time & Photo prototype · v0.1.0 · Mobile-first React PWA matching the Sales Hub
            visual system. Production build adds MSAL.js, Dataverse Web API, Microsoft Graph, and
            Power Automate connectors.
          </div>
        </section>
      </Body>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 pl-0.5">
      {children}
    </div>
  );
}
