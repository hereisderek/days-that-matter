import { callTool } from "./figma-client.mjs";

async function main() {
  console.log("=== Setting up Variables & Design Tokens ===");

  // Retrieve current variables
  const defs = await callTool("get_variable_defs");
  let collection = defs.collections.find(c => c.name.includes("Days That Matter"));
  let collectionId, modeId;

  if (collection) {
    collectionId = collection.id;
    modeId = collection.defaultModeId;
  } else {
    const colRes = await callTool("create_variable_collection", { name: "Days That Matter / Tokens" });
    collectionId = colRes.collectionId;
    modeId = colRes.defaultModeId;
  }

  const existingVars = new Map(defs.variables.map(v => [v.name, v]));

  // Helper to ensure color variable
  async function ensureColorVar(name, hex, scopes = ["ALL_FILLS", "STROKE_COLOR"]) {
    let variableId;
    if (existingVars.has(name)) {
      variableId = existingVars.get(name).id;
    } else {
      const v = await callTool("create_variable", {
        name,
        collectionId,
        resolvedType: "COLOR",
        scopes
      });
      variableId = v.variableId;
    }

    // Convert hex to rgb
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    const a = cleanHex.length === 8 ? parseInt(cleanHex.substring(6, 8), 16) / 255 : 1;

    await callTool("set_variable_value", {
      variableId,
      modeId,
      value: { r, g, b, a }
    });
    return variableId;
  }

  // Helper to ensure float variable
  async function ensureFloatVar(name, value, scopes = ["ALL_SCOPES"]) {
    let variableId;
    if (existingVars.has(name)) {
      variableId = existingVars.get(name).id;
    } else {
      const v = await callTool("create_variable", {
        name,
        collectionId,
        resolvedType: "FLOAT",
        scopes
      });
      variableId = v.variableId;
    }

    await callTool("set_variable_value", {
      variableId,
      modeId,
      value
    });
    return variableId;
  }

  const tokens = {};

  // Colors
  tokens["brand/primary"] = await ensureColorVar("color/brand/primary", "#2563EB");
  tokens["brand/primary-light"] = await ensureColorVar("color/brand/primary-light", "#DBEAFE");
  tokens["brand/on-primary"] = await ensureColorVar("color/brand/on-primary", "#FFFFFF");
  tokens["surface/background"] = await ensureColorVar("color/surface/background", "#0F172A"); // Modern sleek dark base
  tokens["surface/card"] = await ensureColorVar("color/surface/card", "#1E293B");
  tokens["surface/card-subtle"] = await ensureColorVar("color/surface/card-subtle", "#334155");
  tokens["surface/card-glass"] = await ensureColorVar("color/surface/card-glass", "#1E293BCC"); // Translucent glass
  tokens["text/primary"] = await ensureColorVar("color/text/primary", "#F8FAFC");
  tokens["text/secondary"] = await ensureColorVar("color/text/secondary", "#94A3B8");
  tokens["text/tertiary"] = await ensureColorVar("color/text/tertiary", "#64748B");
  tokens["border/subtle"] = await ensureColorVar("color/border/subtle", "#334155");
  tokens["border/strong"] = await ensureColorVar("color/border/strong", "#475569");
  tokens["status/rose"] = await ensureColorVar("color/status/rose", "#F43F5E");
  tokens["status/emerald"] = await ensureColorVar("color/status/emerald", "#10B981");
  tokens["status/amber"] = await ensureColorVar("color/status/amber", "#F59E0B");
  tokens["status/violet"] = await ensureColorVar("color/status/violet", "#8B5CF6");

  // Spacing
  tokens["space/4"] = await ensureFloatVar("space/4", 4, ["GAP"]);
  tokens["space/8"] = await ensureFloatVar("space/8", 8, ["GAP"]);
  tokens["space/12"] = await ensureFloatVar("space/12", 12, ["GAP"]);
  tokens["space/16"] = await ensureFloatVar("space/16", 16, ["GAP"]);
  tokens["space/24"] = await ensureFloatVar("space/24", 24, ["GAP"]);
  tokens["space/32"] = await ensureFloatVar("space/32", 32, ["GAP"]);

  // Radii
  tokens["radius/sm"] = await ensureFloatVar("radius/sm", 8, ["CORNER_RADIUS"]);
  tokens["radius/md"] = await ensureFloatVar("radius/md", 16, ["CORNER_RADIUS"]);
  tokens["radius/lg"] = await ensureFloatVar("radius/lg", 24, ["CORNER_RADIUS"]);
  tokens["radius/pill"] = await ensureFloatVar("radius/pill", 9999, ["CORNER_RADIUS"]);

  console.log("Tokens created successfully. Count:", Object.keys(tokens).length);

  // Text Styles
  console.log("=== Setting up Typography Styles ===");
  const styles = await callTool("get_styles");
  const existingStyles = new Map(styles.texts.map(s => [s.name, s]));

  async function ensureTextStyle(name, fontSize, style = "Bold", lineHeight = undefined) {
    if (existingStyles.has(name)) {
      return existingStyles.get(name).id;
    }
    const res = await callTool("create_text_style", {
      name,
      fontName: { family: "Inter", style },
      fontSize,
      ...(lineHeight ? { lineHeight: { unit: "PIXELS", value: lineHeight } } : { lineHeight: { unit: "AUTO" } })
    });
    return res.styleId;
  }

  const textStyles = {};
  textStyles["Display/Hero"] = await ensureTextStyle("Display/Hero", 48, "Bold", 56);
  textStyles["Display/Medium"] = await ensureTextStyle("Display/Medium", 32, "Bold", 40);
  textStyles["Headline/Screen"] = await ensureTextStyle("Headline/Screen", 22, "Bold", 28);
  textStyles["Title/Card"] = await ensureTextStyle("Title/Card", 17, "Semi Bold", 24);
  textStyles["Body/Medium"] = await ensureTextStyle("Body/Medium", 14, "Medium", 20);
  textStyles["Body/Regular"] = await ensureTextStyle("Body/Regular", 14, "Regular", 20);
  textStyles["Label/Button"] = await ensureTextStyle("Label/Button", 14, "Semi Bold", 20);
  textStyles["Label/Small"] = await ensureTextStyle("Label/Small", 11, "Medium", 16);

  console.log("Text styles created successfully. Count:", Object.keys(textStyles).length);
}

main().catch(console.error);
