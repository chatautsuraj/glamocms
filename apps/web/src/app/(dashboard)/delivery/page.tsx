"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Truck } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { commerceClient, type ApiOrder } from "@/lib/commerce-client";
import {
  datePresetLabel,
  isInDateRange,
  resolveDateRange,
  type DatePreset,
} from "@/lib/date-range";
import { formatNPR } from "@/lib/format";
import { printDeliveryNote, printDeliveryNotes } from "@/lib/print-delivery";
import { toast } from "sonner";

/** Prefer scheduled date for delivery runs; fall back to created. */
function deliveryFilterDate(o: ApiOrder) {
  return o.deliveryScheduledAt || o.createdAt;
}

export default function DeliveryPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [edit, setEdit] = useState<ApiOrder | null>(null);
  const [assignee, setAssignee] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [status, setStatus] = useState("confirmed");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { orders: list } = await commerceClient.listOrders();
      setOrders(list.filter((o) => o.fulfillmentStatus !== "cancelled"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const dateRange = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const filteredOrders = useMemo(
    () => orders.filter((o) => isInDateRange(deliveryFilterDate(o), dateRange)),
    [orders, dateRange],
  );

  const rangeLabel = datePresetLabel(datePreset, customFrom, customTo);

  const active = filteredOrders.filter((d) =>
    ["confirmed", "packed", "out_for_delivery"].includes(d.fulfillmentStatus),
  ).length;
  const delivered = filteredOrders.filter((d) => d.fulfillmentStatus === "delivered").length;

  const printFilteredDelivery = async () => {
    if (!filteredOrders.length) {
      toast.error("No deliveries in this date range");
      return;
    }
    setPrinting(true);
    try {
      const enriched = await Promise.all(
        filteredOrders.map(async (o) => {
          if (o.items?.length) return o;
          try {
            const { order } = await commerceClient.getOrder(o.id);
            return order;
          } catch {
            return o;
          }
        }),
      );
      const ok = printDeliveryNotes({ orders: enriched, rangeLabel });
      if (!ok) toast.error("Allow pop-ups to print delivery notes");
      else toast.success(`Printing ${enriched.length} delivery note(s)`);
    } finally {
      setPrinting(false);
    }
  };

  const printOneNote = async (row: ApiOrder) => {
    try {
      let order = row;
      if (!row.items?.length) {
        const res = await commerceClient.getOrder(row.id);
        order = res.order;
      }
      const ok = printDeliveryNote(order);
      if (!ok) toast.error("Allow pop-ups to print");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not print note");
    }
  };

  const columns: Column<ApiOrder>[] = useMemo(
    () => [
      { key: "id", header: "Order", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
      { key: "customer", header: "Customer", cell: (r) => (
        <div>
          <p>{r.customer?.name ?? "—"}</p>
          {r.customer?.phone && <p className="text-xs text-muted-foreground">{r.customer.phone}</p>}
          {r.channel === "phone" && <Badge variant="success" className="mt-0.5">phone</Badge>}
        </div>
      ) },
      { key: "assignee", header: "Assignee", cell: (r) => r.deliveryAssignee || "—" },
      { key: "address", header: "Address", cell: (r) => r.deliveryAddress || "—" },
      {
        key: "eta",
        header: "Scheduled",
        cell: (r) => (r.deliveryScheduledAt ? new Date(r.deliveryScheduledAt).toLocaleDateString() : "—"),
      },
      {
        key: "partner",
        header: "Partner",
        cell: (r) =>
          r.deliveryExternalId ? (
            <span className="text-xs">
              {r.deliveryPartner ?? "partner"} · {r.deliveryExternalId}
            </span>
          ) : (
            "—"
          ),
      },
      {
        key: "status",
        header: "Status",
        cell: (r) => <Badge variant="muted">{r.fulfillmentStatus}</Badge>,
      },
      {
        key: "amount",
        header: "Amount",
        cell: (r) => formatNPR(Number(r.amount)),
        className: "text-right",
      },
      {
        key: "actions",
        header: "",
        cell: (r) => (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                void printOneNote(r);
              }}
            >
              Note
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setEdit(r);
                setAssignee(r.deliveryAssignee ?? "");
                setAddress(r.deliveryAddress ?? "");
                setNotes(r.deliveryNotes ?? "");
                setScheduled(r.deliveryScheduledAt ? r.deliveryScheduledAt.slice(0, 10) : "");
                setStatus(r.fulfillmentStatus);
              }}
            >
              Manage
            </Button>
          </div>
        ),
        className: "text-right",
      },
    ],
    [],
  );

  const save = async () => {
    if (!edit) return;
    try {
      await commerceClient.updateOrder(edit.id, {
        deliveryAssignee: assignee || undefined,
        deliveryAddress: address || undefined,
        deliveryNotes: notes || undefined,
        deliveryScheduledAt: scheduled || null,
        fulfillmentStatus: status,
      });
      toast.success("Delivery updated");
      setEdit(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const dispatchPartner = async () => {
    if (!edit) return;
    if (!address.trim()) {
      toast.error("Set delivery address first");
      return;
    }
    try {
      await commerceClient.updateOrder(edit.id, {
        deliveryAssignee: assignee || undefined,
        deliveryAddress: address.trim(),
        deliveryNotes: notes || undefined,
        deliveryScheduledAt: scheduled || null,
        fulfillmentStatus: status,
      });
      const res = await commerceClient.dispatchDelivery(edit.id);
      toast.success(
        res.partner
          ? `Dispatched · ${(res.partner as { partner?: string }).partner ?? "partner"}`
          : "Dispatched to delivery partner",
      );
      setEdit(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dispatch failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery"
        description="Filter by date, then print the full delivery sequence for the driver"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
            <Button
              disabled={printing || !filteredOrders.length}
              onClick={() => void printFilteredDelivery()}
            >
              {printing ? "Preparing…" : `Print notes (${filteredOrders.length})`}
            </Button>
          </div>
        }
      />

      <DateRangeFilter
        preset={datePreset}
        onPresetChange={setDatePreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{active}</p>
              <p className="text-xs text-muted-foreground">Active · {rangeLabel}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-success/10 p-3">
              <MapPin className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{delivered}</p>
              <p className="text-xs text-muted-foreground">Delivered</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-muted p-3">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{filteredOrders.length}</p>
              <p className="text-xs text-muted-foreground">In this range</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={filteredOrders}
        columns={columns}
        getRowId={(r) => r.id}
        searchKeys={[(r) => r.customer?.name ?? "", (r) => r.deliveryAssignee ?? "", (r) => r.id]}
        exportFilename="glamo-delivery"
      />

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)} className="max-w-md">
        <DialogContent onClose={() => setEdit(null)}>
          <DialogHeader>
            <DialogTitle>Delivery details</DialogTitle>
            <DialogDescription>{edit?.customer?.name ?? edit?.id}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Assignee / driver</Label>
              <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Scheduled date</Label>
              <Input type="date" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="packed">packed</option>
                <option value="out_for_delivery">out_for_delivery</option>
                <option value="delivered">delivered</option>
              </Select>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => void dispatchPartner()}>
                Send to partner
              </Button>
              <Button onClick={() => void save()}>Save</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Partner API is stubbed until DELIVERY_PARTNER_URL is set — Send still records a manual tracking id.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
