import React, { useState, useCallback, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  ButtonGroup,
  DataTable,
  Badge,
  Banner,
  Spinner,
  EmptyState,
  Text,
  Box,
  InlineStack,
  BlockStack,
  Divider,
} from "@shopify/polaris";
import {
  ExportIcon,
  CheckCircleIcon,
  SearchIcon,
} from "@shopify/polaris-icons";

// ── Config ──────────────────────────────────────────────────────────────────
// In production this points to your deployed Node.js server.
// During local dev the Vite proxy handles /api/* → localhost:3000
const API_BASE = import.meta.env.VITE_API_URL || "";

export default function WaitlistPage() {
  const [waitlist, setWaitlist]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]             = useState(null);
  const [successMsg, setSuccessMsg]   = useState(null);

  // ── Fetch all waitlists ────────────────────────────────────────────────────
  const fetchWaitlist = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res  = await fetch(`${API_BASE}/api/waitlists`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch waitlists.");
      }

      setWaitlist(data.waitlist || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchWaitlist();
  }, [fetchWaitlist]);

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(async () => {
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/waitlist/export-csv`);

      if (!res.ok) {
        throw new Error("Export failed. Please try again.");
      }

      // Trigger browser download
      const blob      = await res.blob();
      const url       = URL.createObjectURL(blob);
      const a         = document.createElement("a");
      a.href          = url;
      a.download      = `waitlist-all.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSuccessMsg("CSV exported successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }, []);

  // ── Mark all as sent ───────────────────────────────────────────────────────
  const handleMarkSent = useCallback(async () => {
    const confirmed = window.confirm(
      "Mark ALL waiting subscribers across ALL products as notified? This cannot be undone."
    );
    if (!confirmed) return;

    setActionLoading(true);
    setError(null);

    try {
      const res  = await fetch(`${API_BASE}/api/waitlist/mark-sent`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({}), // empty body means ALL products
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to mark as sent.");
      }

      setSuccessMsg(`✅ ${data.updated} subscriber(s) marked as notified.`);
      // Refresh table
      await fetchWaitlist();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }, [fetchWaitlist]);

  // ── Badge colour per status ────────────────────────────────────────────────
  function statusBadge(status) {
    if (status === "notified") return <Badge tone="success">Notified</Badge>;
    if (status === "failed") return <Badge tone="critical">Failed</Badge>;
    return <Badge tone="attention">Waiting</Badge>;
  }

  // ── DataTable rows ─────────────────────────────────────────────────────────
  const rows = waitlist.map((entry, i) => [
    i + 1,
    entry.product_title || "—",
    entry.email,
    entry.date,
    entry.notified_date || "—",
    statusBadge(entry.status),
  ]);

  const waitingCount  = waitlist.filter((e) => e.status === "waiting").length;
  const notifiedCount = waitlist.filter((e) => e.status === "notified").length;

  return (
    <Page
      title="Back-in-Stock Waitlist Manager"
      subtitle="View and manage subscriber waitlists for out-of-stock products"
      primaryAction={null}
    >
      <Layout>
        {/* ── Banners ── */}
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        {successMsg && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMsg(null)}>
              <p>{successMsg}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* ── Loading spinner ── */}
        {loading && (
          <Layout.Section>
            <Box padding="800" style={{ textAlign: "center" }}>
              <Spinner accessibilityLabel="Loading waitlist" size="large" />
            </Box>
          </Layout.Section>
        )}

        {/* ── Stats + Actions ── */}
        {!loading && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                {/* Stats row */}
                <InlineStack gap="600" wrap>
                  <BlockStack gap="100">
                    <Text variant="headingLg" as="p" tone="base">
                      {waitlist.length}
                    </Text>
                    <Text variant="bodySm" tone="subdued">Total Subscribers</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text variant="headingLg" as="p" tone="caution">
                      {waitingCount}
                    </Text>
                    <Text variant="bodySm" tone="subdued">Waiting</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text variant="headingLg" as="p" tone="success">
                      {notifiedCount}
                    </Text>
                    <Text variant="bodySm" tone="subdued">Notified</Text>
                  </BlockStack>
                </InlineStack>

                <Divider />

                {/* Action buttons */}
                <InlineStack gap="300">
                  <ButtonGroup>
                    <Button
                      icon={ExportIcon}
                      onClick={handleExportCSV}
                      loading={actionLoading}
                      disabled={actionLoading || waitingCount === 0}
                    >
                      Export Waiting List (CSV)
                    </Button>
                    <Button
                      icon={CheckCircleIcon}
                      tone="success"
                      variant="primary"
                      onClick={handleMarkSent}
                      loading={actionLoading}
                      disabled={actionLoading || waitingCount === 0}
                    >
                      Mark All as Notified
                    </Button>
                  </ButtonGroup>
                </InlineStack>

                {waitingCount === 0 && waitlist.length > 0 && (
                  <Banner tone="info">
                    <p>All subscribers have already been notified.</p>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* ── Data Table ── */}
        {!loading && waitlist.length > 0 && (
          <Layout.Section>
            <Card padding="0">
              <DataTable
                columnContentTypes={[
                  "numeric",
                  "text",
                  "text",
                  "text",
                  "text",
                  "text",
                ]}
                headings={[
                  "#",
                  "Product",
                  "Email",
                  "Subscribed On",
                  "Notified On",
                  "Status",
                ]}
                rows={rows}
                hoverable
                defaultSortDirection="descending"
                initialSortColumnIndex={3}
                stickyHeader
                increasedTableDensity
              />
            </Card>
          </Layout.Section>
        )}

        {/* ── Empty state ── */}
        {!loading && waitlist.length === 0 && (
          <Layout.Section>
            <Card>
              <EmptyState
                heading="No subscribers yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  No one has joined the waitlist for any product yet.
                </p>
              </EmptyState>
            </Card>
          </Layout.Section>
        )}

        {/* ── SOP hint ── */}
        {!loading && waitingCount > 0 && (
          <Layout.Section>
            <Banner tone="info" title="How to notify customers (SOP)">
              <BlockStack gap="200">
                <Text variant="bodySm">
                  1. Click <strong>Export Waiting List (CSV)</strong> above.
                </Text>
                <Text variant="bodySm">
                  2. Go to <strong>Shopify Admin → Customers → Import</strong> and
                  tag them <code>restock_alert</code>.
                </Text>
                <Text variant="bodySm">
                  3. Open <strong>Shopify Email</strong>, send the "Back in Stock"
                  template to customers with the <code>restock_alert</code> tag.
                </Text>
                <Text variant="bodySm">
                  4. Return here and click <strong>Mark All as Notified</strong>.
                </Text>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
