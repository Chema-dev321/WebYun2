# Graph Report - .  (2026-05-12)

## Corpus Check
- Corpus is ~2,942 words - fits in a single context window. You may not need a graph.

## Summary
- 52 nodes · 66 edges · 10 communities (7 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Firebase Config & DB|Firebase Config & DB]]
- [[_COMMUNITY_Core Domain Types|Core Domain Types]]
- [[_COMMUNITY_Cloud Functions & Email|Cloud Functions & Email]]
- [[_COMMUNITY_Client Registration Flow|Client Registration Flow]]
- [[_COMMUNITY_Seed & Geographic Config|Seed & Geographic Config]]
- [[_COMMUNITY_NAP Table & Client Mgmt|NAP Table & Client Mgmt]]
- [[_COMMUNITY_Next.js Layout|Next.js Layout]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]

## God Nodes (most connected - your core abstractions)
1. `NAP` - 5 edges
2. `createTransporter()` - 2 edges
3. `sendEmail()` - 2 edges
4. `getNAPs()` - 2 edges
5. `getClientesByNAP()` - 2 edges
6. `registerCliente()` - 2 edges
7. `deleteCliente()` - 2 edges
8. `getMunicipios()` - 2 edges
9. `getLocalidadesByMunicipio()` - 2 edges
10. `getNAPsByLocalidad()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities (10 total, 3 thin omitted)

### Community 0 - "Firebase Config & DB"
Cohesion: 0.22
Nodes (3): db, firebaseConfig, RegisterResult

### Community 1 - "Core Domain Types"
Cohesion: 0.29
Nodes (5): getNAPs(), Cliente, LocalidadEntry, NAP, SemaphoreColor

### Community 2 - "Cloud Functions & Email"
Cohesion: 0.33
Nodes (6): ClienteData, createTransporter(), NAPData, onClienteDeleted, onNAPUpdated, sendEmail()

### Community 3 - "Client Registration Flow"
Cohesion: 0.29
Nodes (5): Props, getLocalidadesByMunicipio(), getMunicipios(), getNAPsByLocalidad(), registerCliente()

### Community 4 - "Seed & Geographic Config"
Cohesion: 0.33
Nodes (4): CONFIG_GEOGRAFICA, db, firebaseConfig, NAPS

### Community 5 - "NAP Table & Client Mgmt"
Cohesion: 0.33
Nodes (4): Props, deleteCliente(), getClientesByNAP(), getNAPColor()

## Knowledge Gaps
- **16 isolated node(s):** `postcssConfig`, `nextConfig`, `firebaseConfig`, `db`, `CONFIG_GEOGRAFICA` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NAP` connect `Core Domain Types` to `Firebase Config & DB`, `Client Registration Flow`, `NAP Table & Client Mgmt`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `postcssConfig`, `nextConfig`, `firebaseConfig` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._