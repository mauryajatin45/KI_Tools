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
  Popover,
  ActionList,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [exportPopoverActive, setExportPopoverActive] = useState(false);
  const toggleExportPopover = useCallback(() => setExportPopoverActive((active) => !active), []);

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
  const handleExportCSV = useCallback(async (filter = "waiting") => {
    setExportPopoverActive(false);
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/waitlist/export-csv?filter=${filter}`);

      if (!res.ok) {
        throw new Error("Export failed. Please try again.");
      }

      // Trigger browser download
      const blob      = await res.blob();
      const url       = URL.createObjectURL(blob);
      const a         = document.createElement("a");
      a.href          = url;
      a.download      = `waitlist-${filter}.csv`;
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

  // ── Badge colour per status ────────────────────────────────────────────────
  function statusBadge(status) {
    if (status === "notified") return <Badge tone="success">Notified</Badge>;
    if (status === "failed") return <Badge tone="critical">Failed</Badge>;
    return <Badge tone="attention">Waiting</Badge>;
  }

  // ── Filter Data ────────────────────────────────────────────────────────────
  const filteredWaitlist = waitlist.filter((e) => {
    const q = searchQuery.toLowerCase();
    const matchesEmail = e.email.toLowerCase().includes(q);
    const matchesProduct = e.product_title && e.product_title.toLowerCase().includes(q);
    return matchesEmail || matchesProduct;
  });

  // ── DataTable rows ─────────────────────────────────────────────────────────
  const rows = filteredWaitlist.map((entry, i) => [
    i + 1,
    entry.product_title || "—",
    entry.email,
    entry.date,
    entry.notified_date || "—",
    statusBadge(entry.status),
  ]);

  const waitingCount  = waitlist.filter((e) => e.status === "waiting").length;
  const notifiedCount = waitlist.filter((e) => e.status === "notified" || e.status === "failed").length;

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
                  <Popover
                    active={exportPopoverActive}
                    activator={
                      <Button
                        icon={ExportIcon}
                        onClick={toggleExportPopover}
                        loading={actionLoading}
                        disabled={actionLoading || waitlist.length === 0}
                      >
                        Export CSV...
                      </Button>
                    }
                    autofocusTarget="first-node"
                    onClose={toggleExportPopover}
                  >
                    <ActionList
                      actionRole="menuitem"
                      items={[
                        {
                          content: "Export Waiting List",
                          disabled: waitingCount === 0,
                          onAction: () => handleExportCSV("waiting"),
                        },
                        {
                          content: "Export All Subscribers",
                          disabled: waitlist.length === 0,
                          onAction: () => handleExportCSV("all"),
                        },
                      ]}
                    />
                  </Popover>
                </InlineStack>

                {waitingCount === 0 && waitlist.length > 0 && (
                  <Banner tone="info">
                    <p>All subscribers have already been notified. The system is 100% automated.</p>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* ── Filter ── */}
        {!loading && waitlist.length > 0 && (
          <Layout.Section>
            <Card padding="400">
              <TextField
                label="Search Waitlist"
                labelHidden
                placeholder="Search by email or product name..."
                value={searchQuery}
                onChange={setSearchQuery}
                clearButton
                onClearButtonClick={() => setSearchQuery("")}
                prefix={<SearchIcon />}
                autoComplete="off"
              />
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

      </Layout>
    </Page>
  );
}
