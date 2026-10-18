// This tunnel is permanently limited to the six read-only operations.
process.env.VENUS_AUXILIARY_TAGS='0';
process.env.VENUS_URL='http://127.0.0.1:10001';
await import('./readonly-mcp.mjs');
