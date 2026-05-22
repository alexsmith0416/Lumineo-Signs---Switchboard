import type { Role } from "../types";
import {
  installationWidgets,
  opsWidgets,
  productionWidgets,
  salesWidgets,
  shippingWidgets,
} from "../data/mockData";
import WidgetCard from "./WidgetCard";
import BarList from "./BarList";
import ListWidget from "./ListWidget";
import RouteWidget from "./RouteWidget";
import PhotoChecklist from "./PhotoChecklist";

interface Props {
  role: Role;
}

export default function RoleWidgets({ role }: Props) {
  switch (role) {
    case "Operations":
      return (
        <>
          <div className="section-label">Operations dashboard</div>
          <div className="role-grid role-grid--ops">
            <WidgetCard title="Department load" subtitle="hours scheduled this week" className="role-grid__span-2">
              <BarList rows={opsWidgets.deptLoad} />
            </WidgetCard>
            <WidgetCard title="Late tasks" subtitle={`${opsWidgets.lateTasks.length} past scheduled date`}>
              <ListWidget items={opsWidgets.lateTasks} />
            </WidgetCard>
            <WidgetCard title="Pending approvals" subtitle="specs + quotes awaiting Ops" action="Review">
              <ListWidget items={opsWidgets.pendingApprovals} />
            </WidgetCard>
          </div>
        </>
      );

    case "Sales":
      return (
        <>
          <div className="section-label">Sales dashboard</div>
          <div className="role-grid role-grid--sales">
            <WidgetCard title="My pipeline" subtitle="by stage · count + value">
              <BarList rows={salesWidgets.pipeline} />
            </WidgetCard>
            <WidgetCard title="Hot opportunities" subtitle="closing in next 30 days" action="Pipeline">
              <ListWidget items={salesWidgets.hotOpps} />
            </WidgetCard>
            <WidgetCard title="Recent customer activity" subtitle="last 5 touchpoints">
              <ListWidget items={salesWidgets.recentCustomers} />
            </WidgetCard>
            <WidgetCard title="Top customers (90d)" subtitle="by revenue from BC">
              <ListWidget items={salesWidgets.topCustomers} />
            </WidgetCard>
          </div>
        </>
      );

    case "Production":
      return (
        <>
          <div className="section-label">Today on the floor</div>
          <div className="role-grid role-grid--prod">
            <WidgetCard title="Today's tasks" subtitle="tap to clock in" action="My week">
              <ListWidget items={productionWidgets.todaysTasks} />
            </WidgetCard>
            <WidgetCard title="Shop calendar — next 5" subtitle="across the team">
              <ListWidget items={productionWidgets.shopCalendar} />
            </WidgetCard>
            <WidgetCard title="Need help?" subtitle="blocked tasks — anyone can grab" className="role-grid__span-2">
              <ListWidget items={productionWidgets.needHelp} emptyText="No blocked tasks 🎉" />
            </WidgetCard>
          </div>
        </>
      );

    case "Installation":
      return (
        <>
          <div className="section-label">Today's route</div>
          <div className="role-grid role-grid--install">
            <WidgetCard title="Today's stops" subtitle="tap for maps + job detail" action="Open in maps" className="role-grid__span-2">
              <RouteWidget stops={installationWidgets.route} />
            </WidgetCard>
            <WidgetCard title="Required photos — next install" subtitle="checklist for J123456">
              <PhotoChecklist items={installationWidgets.photoChecklist} />
            </WidgetCard>
            <WidgetCard title="Materials pull list" subtitle="needed for next 3 installs">
              <ListWidget items={installationWidgets.materialsPull} />
            </WidgetCard>
          </div>
        </>
      );

    case "Shipping":
      return (
        <>
          <div className="section-label">Shipping floor</div>
          <div className="role-grid role-grid--ship">
            <WidgetCard title="Ready-to-ship queue" subtitle={`${shippingWidgets.readyToShip.length} crates staged`} action="Print labels">
              <ListWidget items={shippingWidgets.readyToShip} />
            </WidgetCard>
            <WidgetCard title="In transit" subtitle="customer-bound shipments">
              <ListWidget items={shippingWidgets.inTransit} />
            </WidgetCard>
            <WidgetCard title="Receiving today" subtitle="inbound vendor deliveries" className="role-grid__span-2">
              <ListWidget items={shippingWidgets.receivingToday} />
            </WidgetCard>
          </div>
        </>
      );
  }
}
