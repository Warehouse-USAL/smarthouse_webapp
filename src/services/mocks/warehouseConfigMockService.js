/*
|--------------------------------------------------------------------------
| WAREHOUSE CONFIG MOCK SERVICE
|--------------------------------------------------------------------------
|
| Persiste la configuración del warehouse en localStorage.
| Compatible con:
| - Alta de productos
| - Asignación de stock
| - Configuración de warehouse
| - Productos recién creados
|
*/

import { localStore } from "../../lib/localStore";

const KEY = "warehouse_config";

const uid = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const delay = (ms = 150) =>
  new Promise((r) => setTimeout(r, ms));

const COLOR_PALETTE = [
  "a",
  "b",
  "c",
  "d",
];

const colorForZone = (idZone) => {
  const key = String(idZone ?? "");

  let hash = 0;

  for (let i = 0; i < key.length; i += 1) {
    hash =
      (hash * 31 +
        key.charCodeAt(i)) |
      0;
  }

  return COLOR_PALETTE[
    Math.abs(hash) %
      COLOR_PALETTE.length
  ];
};

/* -------------------------------------------------------------------------- */
/* POSITIONS */
/* -------------------------------------------------------------------------- */

const buildPosition = ({
  positionIndex,
  sizeStockToSave = "MEDIANA",
}) => ({
  idPosition: uid("pos"),

  positionName: `P${String(
    positionIndex
  ).padStart(2, "0")}`,

  sizeStockToSave,

  assignedProduct: null,
});

/* -------------------------------------------------------------------------- */
/* LINES */
/* -------------------------------------------------------------------------- */

const buildLine = ({
  numberLine,
  maxAllowedPositions,
  sizeStockToSave,
}) => ({
  idLine: uid("line"),

  numberLine,

  maxAllowedPositions,

  positions: Array.from(
    { length: maxAllowedPositions },
    (_, i) =>
      buildPosition({
        positionIndex: i + 1,
        sizeStockToSave,
      })
  ),
});

/* -------------------------------------------------------------------------- */
/* ZONES */
/* -------------------------------------------------------------------------- */

const buildZone = ({
  zoneCode,
  maxAllowedLines,
  defaultPositionSize,
  maxPositionsPerLine,
}) => {
  const idZone = uid("zone");

  return {
    idZone,

    zoneCode,

    name: `Zona ${zoneCode}`,

    color: colorForZone(idZone),

    maxAllowedLines,

    lines: Array.from(
      { length: maxAllowedLines },
      (_, i) =>
        buildLine({
          numberLine: i + 1,
          maxAllowedPositions:
            maxPositionsPerLine,
          sizeStockToSave:
            defaultPositionSize,
        })
    ),
  };
};

/* -------------------------------------------------------------------------- */
/* DEFAULT CONFIG */
/* -------------------------------------------------------------------------- */

const buildDefaultConfig = () => ({
  zones: [
    buildZone({
      zoneCode: "A",
      maxAllowedLines: 4,
      defaultPositionSize:
        "PEQUEÑA",
      maxPositionsPerLine: 12,
    }),

    buildZone({
      zoneCode: "B",
      maxAllowedLines: 4,
      defaultPositionSize:
        "MEDIANA",
      maxPositionsPerLine: 18,
    }),

    buildZone({
      zoneCode: "C",
      maxAllowedLines: 4,
      defaultPositionSize:
        "MEDIANA",
      maxPositionsPerLine: 18,
    }),

    buildZone({
      zoneCode: "D",
      maxAllowedLines: 4,
      defaultPositionSize:
        "GRANDE",
      maxPositionsPerLine: 18,
    }),
  ],
});

/* -------------------------------------------------------------------------- */
/* MIGRATION */
/* -------------------------------------------------------------------------- */

const migrateConfig = (config) => {
  if (
    !config ||
    !Array.isArray(config.zones)
  ) {
    return buildDefaultConfig();
  }

  return {
    ...config,

    zones: config.zones.map(
      (zone) => ({
        ...zone,

        color:
          zone.color ||
          colorForZone(zone.idZone),

        lines: (
          zone.lines || []
        ).map((line) => ({
          ...line,

          positions: (
            line.positions || []
          ).map((position) => ({
            ...position,

            sizeStockToSave:
              position.sizeStockToSave ||
              "MEDIANA",

            assignedProduct:
              position.assignedProduct ||
              null,
          })),
        })),
      })
    ),
  };
};

const isLegacyShape = (raw) => {
  if (
    !raw ||
    !Array.isArray(raw.zones)
  ) {
    return true;
  }

  const sample = raw.zones?.[0];

  if (!sample) return false;

  if ("heights" in sample)
    return true;

  if ("lineOverrides" in sample)
    return true;

  if (
    "positionOverrides" in sample
  )
    return true;

  if ("locationData" in sample)
    return true;

  if (
    !Array.isArray(sample.lines)
  )
    return true;

  return false;
};

/* -------------------------------------------------------------------------- */
/* STORAGE */
/* -------------------------------------------------------------------------- */

const readConfig = () => {
  const raw = localStore.get(
    KEY,
    null
  );

  if (
    !raw ||
    isLegacyShape(raw)
  ) {
    const fresh =
      buildDefaultConfig();

    localStore.set(KEY, fresh);

    return fresh;
  }

  const migrated =
    migrateConfig(raw);

  localStore.set(
    KEY,
    migrated
  );

  return migrated;
};

const writeConfig = (
  config
) => {
  localStore.set(KEY, config);

  return config;
};

/* -------------------------------------------------------------------------- */
/* HELPERS */
/* -------------------------------------------------------------------------- */

const nextZoneCode = (
  zones
) => {
  const used = new Set(
    zones.map((z) => z.zoneCode)
  );

  for (
    let code = 65;
    code <= 90;
    code += 1
  ) {
    const ch =
      String.fromCharCode(code);

    if (!used.has(ch))
      return ch;
  }

  return `Z${
    zones.length + 1
  }`;
};

const mapZone = (
  zones,
  idZone,
  mapper
) =>
  zones.map((z) =>
    z.idZone === idZone
      ? mapper(z)
      : z
  );

const mapLine = (
  zone,
  idLine,
  mapper
) => ({
  ...zone,

  lines: zone.lines.map((l) =>
    l.idLine === idLine
      ? mapper(l)
      : l
  ),
});

const mapPosition = (
  line,
  idPosition,
  mapper
) => ({
  ...line,

  positions: line.positions.map(
    (p) =>
      p.idPosition ===
      idPosition
        ? mapper(p)
        : p
  ),
});

const resizePositions = (
  positions,
  nextCount
) => {
  if (
    nextCount === positions.length
  ) {
    return positions;
  }

  if (
    nextCount < positions.length
  ) {
    return positions.slice(
      0,
      nextCount
    );
  }

  const inheritedSize =
    positions[
      positions.length - 1
    ]?.sizeStockToSave ||
    "MEDIANA";

  const extra = Array.from(
    {
      length:
        nextCount -
        positions.length,
    },
    (_, i) =>
      buildPosition({
        positionIndex:
          positions.length +
          i +
          1,

        sizeStockToSave:
          inheritedSize,
      })
  );

  return [
    ...positions,
    ...extra,
  ];
};

/* -------------------------------------------------------------------------- */
/* SERVICE */
/* -------------------------------------------------------------------------- */

export const warehouseConfigMockService =
  {
    async get() {
      await delay();

      return readConfig();
    },

    /* ------------------------- */
    /* ZONAS */
    /* ------------------------- */

    async addZone({
      defaultPositionSize,
    } = {}) {
      await delay();

      const config =
        readConfig();

      const zoneCode =
        nextZoneCode(
          config.zones
        );

      const zone =
        buildZone({
          zoneCode,

          maxAllowedLines: 4,

          defaultPositionSize:
            defaultPositionSize ||
            "MEDIANA",

          maxPositionsPerLine: 12,
        });

      return writeConfig({
        ...config,

        zones: [
          ...config.zones,
          zone,
        ],
      });
    },

    async updateZone(
      idZone,
      patch
    ) {
      await delay();

      const config =
        readConfig();

      const zones = mapZone(
        config.zones,
        idZone,
        (z) => ({
          ...z,
          ...patch,
        })
      );

      return writeConfig({
        ...config,
        zones,
      });
    },

    async removeZone(idZone) {
      await delay();

      const config =
        readConfig();

      return writeConfig({
        ...config,

        zones:
          config.zones.filter(
            (z) =>
              z.idZone !==
              idZone
          ),
      });
    },

    /* ------------------------- */
    /* LÍNEAS */
    /* ------------------------- */

    async addLine(
      idZone,
      {
        maxAllowedPositions = 12,
      } = {}
    ) {
      await delay();

      const config =
        readConfig();

      const zones = mapZone(
        config.zones,
        idZone,
        (z) => {
          const numberLine =
            (
              z.lines[
                z.lines.length -
                  1
              ]?.numberLine ?? 0
            ) + 1;

          const line =
            buildLine({
              numberLine,

              maxAllowedPositions,

              sizeStockToSave:
                "MEDIANA",
            });

          return {
            ...z,

            lines: [
              ...z.lines,
              line,
            ],
          };
        }
      );

      return writeConfig({
        ...config,
        zones,
      });
    },

    async updateLine(
      idZone,
      idLine,
      patch
    ) {
      await delay();

      const config =
        readConfig();

      const zones = mapZone(
        config.zones,
        idZone,
        (z) =>
          mapLine(
            z,
            idLine,
            (l) => {
              const next = {
                ...l,
                ...patch,
              };

              if (
                patch.maxAllowedPositions !=
                  null &&
                patch.maxAllowedPositions !==
                  l.maxAllowedPositions
              ) {
                next.positions =
                  resizePositions(
                    l.positions,
                    patch.maxAllowedPositions
                  );
              }

              return next;
            }
          )
      );

      return writeConfig({
        ...config,
        zones,
      });
    },

    async removeLine(
      idZone,
      idLine
    ) {
      await delay();

      const config =
        readConfig();

      const zones = mapZone(
        config.zones,
        idZone,
        (z) => ({
          ...z,

          lines:
            z.lines.filter(
              (l) =>
                l.idLine !==
                idLine
            ),
        })
      );

      return writeConfig({
        ...config,
        zones,
      });
    },

    /* ------------------------- */
    /* POSICIONES */
    /* ------------------------- */

    async updatePosition(
      idZone,
      idLine,
      idPosition,
      patch
    ) {
      await delay();

      const config =
        readConfig();

      const zones = mapZone(
        config.zones,
        idZone,
        (z) =>
          mapLine(
            z,
            idLine,
            (l) =>
              mapPosition(
                l,
                idPosition,
                (p) => ({
                  ...p,
                  ...patch,
                })
              )
          )
      );

      return writeConfig({
        ...config,
        zones,
      });
    },

    async getPosition(
      idPosition
    ) {
      await delay();

      const config =
        readConfig();

      for (const z of config.zones) {
        for (const l of z.lines) {
          const found =
            l.positions.find(
              (p) =>
                p.idPosition ===
                idPosition
            );

          if (found)
            return found;
        }
      }

      return null;
    },

    /* ------------------------- */
    /* ASIGNACIÓN */
    /* ------------------------- */

    async setAssignedProduct(
      idPosition,
      productSummary
    ) {
      await delay();

      const config =
        readConfig();

      const zones =
        config.zones.map(
          (z) => ({
            ...z,

            lines: z.lines.map(
              (l) => ({
                ...l,

                positions:
                  l.positions.map(
                    (p) =>
                      p.idPosition ===
                      idPosition
                        ? {
                            ...p,

                            assignedProduct:
                              productSummary ||
                              null,
                          }
                        : p
                  ),
              })
            ),
          })
        );

      return writeConfig({
        ...config,
        zones,
      });
    },

    // COMPATIBILIDAD
    // Tu StockAssignmentPage usa esto

    async assignProductToPosition(
      idPosition,
      productSummary
    ) {
      return this.setAssignedProduct(
        idPosition,
        productSummary
      );
    },

    async clearAssignedProduct(
      idPosition
    ) {
      return this.setAssignedProduct(
        idPosition,
        null
      );
    },
  };