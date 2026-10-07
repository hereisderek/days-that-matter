import { callTool } from "./figma-client.mjs";

async function main() {
  console.log("=== Building Complete Days That Matter Design System ===");

  const vars = await callTool("get_variable_defs");
  const varMap = new Map(vars.variables.map(v => [v.name, v.id]));
  const styles = await callTool("get_styles");
  const styleMap = new Map(styles.texts.map(s => [s.name, s.id]));

  // Helper to bind color
  async function bindColor(nodeId, variableName, target = "fills", fallback = { r: 1, g: 1, b: 1 }) {
    if (varMap.has(variableName)) {
      await callTool("bind_variable_to_paint", {
        nodeId,
        target,
        variableId: varMap.get(variableName)
      });
    }
  }

  // Helper to bind radius
  async function bindRadius(nodeId, radiusVarName) {
    if (varMap.has(radiusVarName)) {
      await callTool("bind_variable_to_node", {
        nodeId,
        field: "cornerRadius",
        variableId: varMap.get(radiusVarName)
      });
    }
  }

  // Helper to apply text style
  async function applyText(nodeId, styleName) {
    if (styleMap.has(styleName)) {
      await callTool("apply_style_to_node", {
        nodeId,
        styleId: styleMap.get(styleName),
        field: "text"
      });
    }
  }

  // Store components map
  const components = {};

  // 1. SECTION: Design System Components (placed at x: 0, y: 0)
  const componentsSection = await callTool("create_frame", {
    name: "🎨 Component Library",
    x: -1200,
    y: 0,
    width: 1000,
    height: 1200
  });

  await callTool("set_auto_layout", {
    nodeId: componentsSection.nodeId,
    layoutMode: "VERTICAL",
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 40,
    paddingRight: 40,
    itemSpacing: 32
  });
  await callTool("set_fills", {
    nodeId: componentsSection.nodeId,
    fills: [{ type: "SOLID", color: { r: 0.05, g: 0.08, b: 0.14 } }]
  });
  await bindColor(componentsSection.nodeId, "color/surface/background");

  // Title for Components
  const compSectionTitle = await callTool("create_text", {
    parentId: componentsSection.nodeId,
    characters: "Days That Matter — Shared Component Library"
  });
  await applyText(compSectionTitle.nodeId, "Headline/Screen");
  await callTool("set_fills", { nodeId: compSectionTitle.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });
  await bindColor(compSectionTitle.nodeId, "color/text/primary");

  // --- COMPONENT: Secondary Button ---
  const btnSecondary = await callTool("create_component", {
    parentId: componentsSection.nodeId,
    name: "Component / Button-Secondary"
  });
  components["Button-Secondary"] = btnSecondary.nodeId;
  await callTool("set_auto_layout", {
    nodeId: btnSecondary.nodeId,
    layoutMode: "HORIZONTAL",
    paddingTop: 12, paddingBottom: 12, paddingLeft: 20, paddingRight: 20,
    itemSpacing: 8,
    primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_corner_radius", { nodeId: btnSecondary.nodeId, radius: 9999 });
  await bindRadius(btnSecondary.nodeId, "radius/pill");
  await callTool("set_fills", { nodeId: btnSecondary.nodeId, fills: [{ type: "SOLID", color: { r: 0.12, g: 0.16, b: 0.23 } }] });
  await bindColor(btnSecondary.nodeId, "color/surface/card-subtle");
  await callTool("set_strokes", {
    nodeId: btnSecondary.nodeId,
    strokes: [{ type: "SOLID", color: { r: 0.2, g: 0.25, b: 0.33 } }],
    strokeWeight: 1
  });
  await bindColor(btnSecondary.nodeId, "color/border/subtle", "strokes");

  const btnSecText = await callTool("create_text", { parentId: btnSecondary.nodeId, characters: "Cancel" });
  await applyText(btnSecText.nodeId, "Label/Button");
  await callTool("set_fills", { nodeId: btnSecText.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });
  await bindColor(btnSecText.nodeId, "color/text/primary");

  // --- COMPONENT: Category Chip ---
  const categoryChip = await callTool("create_component", {
    parentId: componentsSection.nodeId,
    name: "Component / Category-Chip"
  });
  components["Category-Chip"] = categoryChip.nodeId;
  await callTool("set_auto_layout", {
    nodeId: categoryChip.nodeId,
    layoutMode: "HORIZONTAL",
    paddingTop: 8, paddingBottom: 8, paddingLeft: 16, paddingRight: 16,
    itemSpacing: 6,
    primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_corner_radius", { nodeId: categoryChip.nodeId, radius: 9999 });
  await bindRadius(categoryChip.nodeId, "radius/pill");
  await callTool("set_fills", { nodeId: categoryChip.nodeId, fills: [{ type: "SOLID", color: { r: 0.12, g: 0.16, b: 0.23 } }] });
  await bindColor(categoryChip.nodeId, "color/surface/card-subtle");
  await callTool("set_strokes", {
    nodeId: categoryChip.nodeId,
    strokes: [{ type: "SOLID", color: { r: 0.2, g: 0.25, b: 0.33 } }],
    strokeWeight: 1
  });
  await bindColor(categoryChip.nodeId, "color/border/subtle", "strokes");

  const chipText = await callTool("create_text", { parentId: categoryChip.nodeId, characters: "🌟 Milestones" });
  await applyText(chipText.nodeId, "Body/Medium");
  await callTool("set_fills", { nodeId: chipText.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });
  await bindColor(chipText.nodeId, "color/text/primary");

  // --- COMPONENT: Countdown Unit Box ---
  const countdownUnit = await callTool("create_component", {
    parentId: componentsSection.nodeId,
    name: "Component / Countdown-Unit-Box"
  });
  components["Countdown-Unit-Box"] = countdownUnit.nodeId;
  await callTool("set_auto_layout", {
    nodeId: countdownUnit.nodeId,
    layoutMode: "VERTICAL",
    paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16,
    itemSpacing: 4,
    primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_corner_radius", { nodeId: countdownUnit.nodeId, radius: 16 });
  await bindRadius(countdownUnit.nodeId, "radius/md");
  await callTool("set_fills", { nodeId: countdownUnit.nodeId, fills: [{ type: "SOLID", color: { r: 0.12, g: 0.16, b: 0.23 } }] });
  await bindColor(countdownUnit.nodeId, "color/surface/card");
  await callTool("set_strokes", {
    nodeId: countdownUnit.nodeId,
    strokes: [{ type: "SOLID", color: { r: 0.2, g: 0.25, b: 0.33 } }],
    strokeWeight: 1
  });
  await bindColor(countdownUnit.nodeId, "color/border/subtle", "strokes");

  const unitVal = await callTool("create_text", { parentId: countdownUnit.nodeId, characters: "42" });
  await applyText(unitVal.nodeId, "Display/Medium");
  await callTool("set_fills", { nodeId: unitVal.nodeId, fills: [{ type: "SOLID", color: { r: 0.145, g: 0.388, b: 0.922 } }] });
  await bindColor(unitVal.nodeId, "color/brand/primary");

  const unitLabel = await callTool("create_text", { parentId: countdownUnit.nodeId, characters: "DAYS" });
  await applyText(unitLabel.nodeId, "Label/Small");
  await callTool("set_fills", { nodeId: unitLabel.nodeId, fills: [{ type: "SOLID", color: { r: 0.6, g: 0.65, b: 0.72 } }] });
  await bindColor(unitLabel.nodeId, "color/text/secondary");

  // --- COMPONENT: Event List Item Card ---
  const eventListItem = await callTool("create_component", {
    parentId: componentsSection.nodeId,
    name: "Component / Event-List-Item",
    width: 345
  });
  components["Event-List-Item"] = eventListItem.nodeId;
  await callTool("set_auto_layout", {
    nodeId: eventListItem.nodeId,
    layoutMode: "HORIZONTAL",
    paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 16,
    itemSpacing: 12,
    primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_corner_radius", { nodeId: eventListItem.nodeId, radius: 16 });
  await bindRadius(eventListItem.nodeId, "radius/md");
  await callTool("set_fills", { nodeId: eventListItem.nodeId, fills: [{ type: "SOLID", color: { r: 0.12, g: 0.16, b: 0.23 } }] });
  await bindColor(eventListItem.nodeId, "color/surface/card");
  await callTool("set_strokes", {
    nodeId: eventListItem.nodeId,
    strokes: [{ type: "SOLID", color: { r: 0.2, g: 0.25, b: 0.33 } }],
    strokeWeight: 1
  });
  await bindColor(eventListItem.nodeId, "color/border/subtle", "strokes");

  // Left Content Col (Icon + Title + Date)
  const itemLeftCol = await callTool("create_frame", {
    parentId: eventListItem.nodeId,
    name: "Content"
  });
  await callTool("set_auto_layout", {
    nodeId: itemLeftCol.nodeId,
    layoutMode: "VERTICAL",
    itemSpacing: 4
  });
  await callTool("set_fills", { nodeId: itemLeftCol.nodeId, fills: [] });

  const itemTitle = await callTool("create_text", { parentId: itemLeftCol.nodeId, characters: "Wedding Anniversary" });
  await applyText(itemTitle.nodeId, "Title/Card");
  await callTool("set_fills", { nodeId: itemTitle.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });
  await bindColor(itemTitle.nodeId, "color/text/primary");

  const itemDate = await callTool("create_text", { parentId: itemLeftCol.nodeId, characters: "November 14, 2026 • 5th Year" });
  await applyText(itemDate.nodeId, "Label/Small");
  await callTool("set_fills", { nodeId: itemDate.nodeId, fills: [{ type: "SOLID", color: { r: 0.6, g: 0.65, b: 0.72 } }] });
  await bindColor(itemDate.nodeId, "color/text/secondary");

  // Right Badge (Days Count Pill)
  const itemRightBadge = await callTool("create_frame", {
    parentId: eventListItem.nodeId,
    name: "Badge"
  });
  await callTool("set_auto_layout", {
    nodeId: itemRightBadge.nodeId,
    layoutMode: "HORIZONTAL",
    paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12,
    itemSpacing: 4,
    primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_corner_radius", { nodeId: itemRightBadge.nodeId, radius: 9999 });
  await bindRadius(itemRightBadge.nodeId, "radius/pill");
  await callTool("set_fills", { nodeId: itemRightBadge.nodeId, fills: [{ type: "SOLID", color: { r: 0.145, g: 0.388, b: 0.922 } }] });
  await bindColor(itemRightBadge.nodeId, "color/brand/primary");

  const badgeText = await callTool("create_text", { parentId: itemRightBadge.nodeId, characters: "38 DAYS" });
  await applyText(badgeText.nodeId, "Label/Small");
  await callTool("set_fills", { nodeId: badgeText.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });
  await bindColor(badgeText.nodeId, "color/brand/on-primary");

  // --- COMPONENT: Top App Bar ---
  const topAppBar = await callTool("create_component", {
    parentId: componentsSection.nodeId,
    name: "Component / Top-App-Bar",
    width: 393
  });
  components["Top-App-Bar"] = topAppBar.nodeId;
  await callTool("set_auto_layout", {
    nodeId: topAppBar.nodeId,
    layoutMode: "HORIZONTAL",
    paddingTop: 20, paddingBottom: 16, paddingLeft: 24, paddingRight: 24,
    itemSpacing: 12,
    primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_fills", { nodeId: topAppBar.nodeId, fills: [{ type: "SOLID", color: { r: 0.05, g: 0.08, b: 0.14 } }] });
  await bindColor(topAppBar.nodeId, "color/surface/background");

  const appTitle = await callTool("create_text", { parentId: topAppBar.nodeId, characters: "Days That Matter" });
  await applyText(appTitle.nodeId, "Headline/Screen");
  await callTool("set_fills", { nodeId: appTitle.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });
  await bindColor(appTitle.nodeId, "color/text/primary");

  const appActions = await callTool("create_text", { parentId: topAppBar.nodeId, characters: "🔍  ⚙️" });
  await applyText(appActions.nodeId, "Body/Medium");
  await callTool("set_fills", { nodeId: appActions.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });

  // --- COMPONENT: Bottom Nav Bar ---
  const bottomNavBar = await callTool("create_component", {
    parentId: componentsSection.nodeId,
    name: "Component / Bottom-Nav-Bar",
    width: 393
  });
  components["Bottom-Nav-Bar"] = bottomNavBar.nodeId;
  await callTool("set_auto_layout", {
    nodeId: bottomNavBar.nodeId,
    layoutMode: "HORIZONTAL",
    paddingTop: 14, paddingBottom: 28, paddingLeft: 24, paddingRight: 24,
    itemSpacing: 16,
    primaryAxisAlignItems: "SPACE_AROUND", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_fills", { nodeId: bottomNavBar.nodeId, fills: [{ type: "SOLID", color: { r: 0.08, g: 0.12, b: 0.19 } }] });
  await bindColor(bottomNavBar.nodeId, "color/surface/card");
  await callTool("set_strokes", {
    nodeId: bottomNavBar.nodeId,
    strokes: [{ type: "SOLID", color: { r: 0.2, g: 0.25, b: 0.33 } }],
    strokeTopWeight: 1
  });
  await bindColor(bottomNavBar.nodeId, "color/border/subtle", "strokes");

  const navItem1 = await callTool("create_text", { parentId: bottomNavBar.nodeId, characters: "📅 Events" });
  await applyText(navItem1.nodeId, "Body/Medium");
  await bindColor(navItem1.nodeId, "color/brand/primary");

  const navItem2 = await callTool("create_text", { parentId: bottomNavBar.nodeId, characters: "⭐ Milestones" });
  await applyText(navItem2.nodeId, "Body/Medium");
  await bindColor(navItem2.nodeId, "color/text/secondary");

  const navItem3 = await callTool("create_text", { parentId: bottomNavBar.nodeId, characters: "➕ Add" });
  await applyText(navItem3.nodeId, "Body/Medium");
  await bindColor(navItem3.nodeId, "color/brand/primary");

  const navItem4 = await callTool("create_text", { parentId: bottomNavBar.nodeId, characters: "📝 Memos" });
  await applyText(navItem4.nodeId, "Body/Medium");
  await bindColor(navItem4.nodeId, "color/text/secondary");

  console.log("Components created successfully. Count:", Object.keys(components).length);

  // =========================================================================
  // 2. NOW ASSEMBLE SCREENS FROM THESE REUSABLE COMPONENTS
  // =========================================================================

  // SCREEN 1: Home Dashboard (x: 0, y: 0)
  console.log("=== Assembling Screen 1: Home Dashboard ===");
  const homeScreen = await callTool("create_frame", {
    name: "📱 Screen 1: Home Dashboard",
    x: 0,
    y: 0,
    width: 393,
    height: 852
  });
  await callTool("set_auto_layout", {
    nodeId: homeScreen.nodeId,
    layoutMode: "VERTICAL",
    primaryAxisAlignItems: "SPACE_BETWEEN"
  });
  await callTool("set_fills", {
    nodeId: homeScreen.nodeId,
    fills: [{ type: "SOLID", color: { r: 0.05, g: 0.08, b: 0.14 } }]
  });
  await bindColor(homeScreen.nodeId, "color/surface/background");

  // Top Container for Home
  const homeTopContent = await callTool("create_frame", {
    parentId: homeScreen.nodeId,
    name: "Main Scroll Area"
  });
  await callTool("set_auto_layout", {
    nodeId: homeTopContent.nodeId,
    layoutMode: "VERTICAL",
    paddingTop: 16, paddingBottom: 16, paddingLeft: 24, paddingRight: 24,
    itemSpacing: 20
  });
  await callTool("set_fills", { nodeId: homeTopContent.nodeId, fills: [] });

  // Top App Bar Instance
  await callTool("create_instance", {
    componentId: components["Top-App-Bar"],
    parentId: homeTopContent.nodeId
  });

  // Category Pills Row
  const chipsRow = await callTool("create_frame", {
    parentId: homeTopContent.nodeId,
    name: "Category Pills Row"
  });
  await callTool("set_auto_layout", {
    nodeId: chipsRow.nodeId,
    layoutMode: "HORIZONTAL",
    itemSpacing: 8
  });
  await callTool("set_fills", { nodeId: chipsRow.nodeId, fills: [] });

  await callTool("create_instance", { componentId: components["Category-Chip"], parentId: chipsRow.nodeId });
  await callTool("create_instance", { componentId: components["Category-Chip"], parentId: chipsRow.nodeId });
  await callTool("create_instance", { componentId: components["Category-Chip"], parentId: chipsRow.nodeId });

  // Featured Hero Card
  const heroCard = await callTool("create_frame", {
    parentId: homeTopContent.nodeId,
    name: "Featured Milestone Hero Card",
    width: 345
  });
  await callTool("set_auto_layout", {
    nodeId: heroCard.nodeId,
    layoutMode: "VERTICAL",
    paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24,
    itemSpacing: 16
  });
  await callTool("set_corner_radius", { nodeId: heroCard.nodeId, radius: 24 });
  await bindRadius(heroCard.nodeId, "radius/lg");
  await callTool("set_fills", {
    nodeId: heroCard.nodeId,
    fills: [{
      type: "GRADIENT_LINEAR",
      gradientStops: [
        { position: 0, color: { r: 0.145, g: 0.388, b: 0.922, a: 1 } },
        { position: 1, color: { r: 0.545, g: 0.235, b: 0.965, a: 1 } }
      ],
      gradientTransform: [[1, 0, 0], [0, 1, 0]]
    }]
  });

  // Hero Card Top Meta
  const heroMetaRow = await callTool("create_frame", { parentId: heroCard.nodeId, name: "Meta Row" });
  await callTool("set_auto_layout", {
    nodeId: heroMetaRow.nodeId,
    layoutMode: "HORIZONTAL",
    primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_fills", { nodeId: heroMetaRow.nodeId, fills: [] });
  await callTool("set_layout_props", { nodeId: heroMetaRow.nodeId, layoutSizingHorizontal: "FILL" });

  const heroPinnedBadge = await callTool("create_text", { parentId: heroMetaRow.nodeId, characters: "📌 PINNED MILESTONE" });
  await applyText(heroPinnedBadge.nodeId, "Label/Small");
  await callTool("set_fills", { nodeId: heroPinnedBadge.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });

  const heroAudioIcon = await callTool("create_text", { parentId: heroMetaRow.nodeId, characters: "🎵 Ambient Theme" });
  await applyText(heroAudioIcon.nodeId, "Label/Small");
  await callTool("set_fills", { nodeId: heroAudioIcon.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });

  const heroTitle = await callTool("create_text", { parentId: heroCard.nodeId, characters: "Trip to Tokyo & Kyoto" });
  await applyText(heroTitle.nodeId, "Headline/Screen");
  await callTool("set_fills", { nodeId: heroTitle.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });

  // Big Countdown Row inside Hero
  const heroCountRow = await callTool("create_frame", { parentId: heroCard.nodeId, name: "Countdown Ticker Row" });
  await callTool("set_auto_layout", {
    nodeId: heroCountRow.nodeId,
    layoutMode: "HORIZONTAL",
    itemSpacing: 12
  });
  await callTool("set_fills", { nodeId: heroCountRow.nodeId, fills: [] });

  await callTool("create_instance", { componentId: components["Countdown-Unit-Box"], parentId: heroCountRow.nodeId });
  await callTool("create_instance", { componentId: components["Countdown-Unit-Box"], parentId: heroCountRow.nodeId });
  await callTool("create_instance", { componentId: components["Countdown-Unit-Box"], parentId: heroCountRow.nodeId });

  // Upcoming Section Title
  const upcomingHeader = await callTool("create_text", { parentId: homeTopContent.nodeId, characters: "Upcoming Events" });
  await applyText(upcomingHeader.nodeId, "Title/Card");
  await bindColor(upcomingHeader.nodeId, "color/text/primary");

  // Event List Items
  await callTool("create_instance", { componentId: components["Event-List-Item"], parentId: homeTopContent.nodeId });
  await callTool("create_instance", { componentId: components["Event-List-Item"], parentId: homeTopContent.nodeId });

  // Bottom Nav Bar Instance on Home
  await callTool("create_instance", {
    componentId: components["Bottom-Nav-Bar"],
    parentId: homeScreen.nodeId
  });

  // =========================================================================
  // SCREEN 2: Event Detail Screen (x: 440, y: 0)
  // =========================================================================
  console.log("=== Assembling Screen 2: Event Detail Screen ===");
  const detailScreen = await callTool("create_frame", {
    name: "📱 Screen 2: Event Detail",
    x: 440,
    y: 0,
    width: 393,
    height: 852
  });
  await callTool("set_auto_layout", {
    nodeId: detailScreen.nodeId,
    layoutMode: "VERTICAL",
    paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24,
    itemSpacing: 24
  });
  await callTool("set_fills", {
    nodeId: detailScreen.nodeId,
    fills: [{ type: "SOLID", color: { r: 0.05, g: 0.08, b: 0.14 } }]
  });
  await bindColor(detailScreen.nodeId, "color/surface/background");

  // Nav row
  const detailNav = await callTool("create_frame", { parentId: detailScreen.nodeId, name: "Top Navigation" });
  await callTool("set_auto_layout", {
    nodeId: detailNav.nodeId,
    layoutMode: "HORIZONTAL",
    primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_fills", { nodeId: detailNav.nodeId, fills: [] });
  await callTool("set_layout_props", { nodeId: detailNav.nodeId, layoutSizingHorizontal: "FILL" });

  const detailBack = await callTool("create_text", { parentId: detailNav.nodeId, characters: "← Back" });
  await applyText(detailBack.nodeId, "Body/Medium");
  await bindColor(detailBack.nodeId, "color/brand/primary");

  const detailActions = await callTool("create_text", { parentId: detailNav.nodeId, characters: "📤 Share   ✏️ Edit" });
  await applyText(detailActions.nodeId, "Body/Medium");
  await bindColor(detailActions.nodeId, "color/text/primary");

  // Hero Countdown Display
  const detailDisplayCard = await callTool("create_frame", { parentId: detailScreen.nodeId, name: "Hero Header", width: 345 });
  await callTool("set_auto_layout", {
    nodeId: detailDisplayCard.nodeId,
    layoutMode: "VERTICAL",
    paddingTop: 32, paddingBottom: 32, paddingLeft: 24, paddingRight: 24,
    itemSpacing: 12,
    primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_corner_radius", { nodeId: detailDisplayCard.nodeId, radius: 24 });
  await bindRadius(detailDisplayCard.nodeId, "radius/lg");
  await callTool("set_fills", {
    nodeId: detailDisplayCard.nodeId,
    fills: [{ type: "SOLID", color: { r: 0.12, g: 0.16, b: 0.23 } }]
  });
  await bindColor(detailDisplayCard.nodeId, "color/surface/card");

  const detailTitle = await callTool("create_text", { parentId: detailDisplayCard.nodeId, characters: "Trip to Tokyo & Kyoto" });
  await applyText(detailTitle.nodeId, "Headline/Screen");
  await bindColor(detailTitle.nodeId, "color/text/primary");

  const detailBigDays = await callTool("create_text", { parentId: detailDisplayCard.nodeId, characters: "42 DAYS" });
  await applyText(detailBigDays.nodeId, "Display/Hero");
  await bindColor(detailBigDays.nodeId, "color/brand/primary");

  const detailTargetDate = await callTool("create_text", { parentId: detailDisplayCard.nodeId, characters: "Target: November 18, 2026 • 09:30 AM" });
  await applyText(detailTargetDate.nodeId, "Label/Small");
  await bindColor(detailTargetDate.nodeId, "color/text/secondary");

  // Audio Playback Bar
  const audioBar = await callTool("create_frame", { parentId: detailScreen.nodeId, name: "Audio Bar", width: 345 });
  await callTool("set_auto_layout", {
    nodeId: audioBar.nodeId,
    layoutMode: "HORIZONTAL",
    paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16,
    itemSpacing: 12,
    primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_corner_radius", { nodeId: audioBar.nodeId, radius: 16 });
  await bindRadius(audioBar.nodeId, "radius/md");
  await callTool("set_fills", { nodeId: audioBar.nodeId, fills: [{ type: "SOLID", color: { r: 0.12, g: 0.16, b: 0.23 } }] });
  await bindColor(audioBar.nodeId, "color/surface/card-subtle");

  const audioTrackInfo = await callTool("create_text", { parentId: audioBar.nodeId, characters: "🎵 Playing: Tokyo Nights Lo-Fi" });
  await applyText(audioTrackInfo.nodeId, "Body/Medium");
  await bindColor(audioTrackInfo.nodeId, "color/text/primary");

  const audioControlIcon = await callTool("create_text", { parentId: audioBar.nodeId, characters: "⏸️" });
  await applyText(audioControlIcon.nodeId, "Body/Medium");

  // Memos Section
  const memoHeader = await callTool("create_text", { parentId: detailScreen.nodeId, characters: "Milestone Memories & Notes" });
  await applyText(memoHeader.nodeId, "Title/Card");
  await bindColor(memoHeader.nodeId, "color/text/primary");

  const memoCard = await callTool("create_frame", { parentId: detailScreen.nodeId, name: "Memo Card", width: 345 });
  await callTool("set_auto_layout", {
    nodeId: memoCard.nodeId,
    layoutMode: "VERTICAL",
    paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 16,
    itemSpacing: 6
  });
  await callTool("set_corner_radius", { nodeId: memoCard.nodeId, radius: 16 });
  await bindRadius(memoCard.nodeId, "radius/md");
  await callTool("set_fills", { nodeId: memoCard.nodeId, fills: [{ type: "SOLID", color: { r: 0.12, g: 0.16, b: 0.23 } }] });
  await bindColor(memoCard.nodeId, "color/surface/card");

  const memoAuthor = await callTool("create_text", { parentId: memoCard.nodeId, characters: "Derek Zhu • 2 days ago" });
  await applyText(memoAuthor.nodeId, "Label/Small");
  await bindColor(memoAuthor.nodeId, "color/brand/primary");

  const memoBody = await callTool("create_text", { parentId: memoCard.nodeId, characters: "Booked flights with ANA! Looking forward to ramen in Shinjuku and temple visits in Kyoto." });
  await applyText(memoBody.nodeId, "Body/Regular");
  await bindColor(memoBody.nodeId, "color/text/primary");

  // Button Instance
  await callTool("create_instance", {
    componentId: "2:38", // Button-Primary
    parentId: detailScreen.nodeId
  });

  // =========================================================================
  // SCREEN 3: Event Editor & Themer (x: 880, y: 0)
  // =========================================================================
  console.log("=== Assembling Screen 3: Event Editor ===");
  const editScreen = await callTool("create_frame", {
    name: "📱 Screen 3: Event Editor & Themer",
    x: 880,
    y: 0,
    width: 393,
    height: 852
  });
  await callTool("set_auto_layout", {
    nodeId: editScreen.nodeId,
    layoutMode: "VERTICAL",
    paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24,
    itemSpacing: 20
  });
  await callTool("set_fills", {
    nodeId: editScreen.nodeId,
    fills: [{ type: "SOLID", color: { r: 0.05, g: 0.08, b: 0.14 } }]
  });
  await bindColor(editScreen.nodeId, "color/surface/background");

  // Top Bar Edit
  const editTop = await callTool("create_frame", { parentId: editScreen.nodeId, name: "Editor Top Bar" });
  await callTool("set_auto_layout", {
    nodeId: editTop.nodeId,
    layoutMode: "HORIZONTAL",
    primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_fills", { nodeId: editTop.nodeId, fills: [] });
  await callTool("set_layout_props", { nodeId: editTop.nodeId, layoutSizingHorizontal: "FILL" });

  const editCancel = await callTool("create_text", { parentId: editTop.nodeId, characters: "Cancel" });
  await applyText(editCancel.nodeId, "Body/Medium");
  await bindColor(editCancel.nodeId, "color/text/secondary");

  const editHeaderTitle = await callTool("create_text", { parentId: editTop.nodeId, characters: "Edit Milestone" });
  await applyText(editHeaderTitle.nodeId, "Headline/Screen");
  await bindColor(editHeaderTitle.nodeId, "color/text/primary");

  const editSave = await callTool("create_text", { parentId: editTop.nodeId, characters: "Save" });
  await applyText(editSave.nodeId, "Body/Medium");
  await bindColor(editSave.nodeId, "color/brand/primary");

  // Mini Live Preview
  const livePreviewLabel = await callTool("create_text", { parentId: editScreen.nodeId, characters: "LIVE CARD PREVIEW" });
  await applyText(livePreviewLabel.nodeId, "Label/Small");
  await bindColor(livePreviewLabel.nodeId, "color/text/secondary");

  await callTool("create_instance", {
    componentId: components["Event-List-Item"],
    parentId: editScreen.nodeId
  });

  // Form Field: Title Input Box
  const titleField = await callTool("create_frame", { parentId: editScreen.nodeId, name: "Field: Title", width: 345 });
  await callTool("set_auto_layout", {
    nodeId: titleField.nodeId,
    layoutMode: "VERTICAL",
    paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16,
    itemSpacing: 4
  });
  await callTool("set_corner_radius", { nodeId: titleField.nodeId, radius: 12 });
  await callTool("set_fills", { nodeId: titleField.nodeId, fills: [{ type: "SOLID", color: { r: 0.12, g: 0.16, b: 0.23 } }] });
  await bindColor(titleField.nodeId, "color/surface/card");
  await callTool("set_strokes", {
    nodeId: titleField.nodeId,
    strokes: [{ type: "SOLID", color: { r: 0.2, g: 0.25, b: 0.33 } }],
    strokeWeight: 1
  });

  const labelTitleFld = await callTool("create_text", { parentId: titleField.nodeId, characters: "Event Title" });
  await applyText(labelTitleFld.nodeId, "Label/Small");
  await bindColor(labelTitleFld.nodeId, "color/text/secondary");

  const valTitleFld = await callTool("create_text", { parentId: titleField.nodeId, characters: "Trip to Tokyo & Kyoto" });
  await applyText(valTitleFld.nodeId, "Body/Medium");
  await bindColor(valTitleFld.nodeId, "color/text/primary");

  // Theme Palette Selection Chips
  const paletteHeader = await callTool("create_text", { parentId: editScreen.nodeId, characters: "Select Theme Accent" });
  await applyText(paletteHeader.nodeId, "Title/Card");
  await bindColor(paletteHeader.nodeId, "color/text/primary");

  const paletteRow = await callTool("create_frame", { parentId: editScreen.nodeId, name: "Palette Circles" });
  await callTool("set_auto_layout", {
    nodeId: paletteRow.nodeId,
    layoutMode: "HORIZONTAL",
    itemSpacing: 14
  });
  await callTool("set_fills", { nodeId: paletteRow.nodeId, fills: [] });

  const colors = [
    { name: "Blue", color: { r: 0.145, g: 0.388, b: 0.922 } },
    { name: "Rose", color: { r: 0.957, g: 0.247, b: 0.369 } },
    { name: "Emerald", color: { r: 0.063, g: 0.725, b: 0.506 } },
    { name: "Amber", color: { r: 0.961, g: 0.620, b: 0.043 } },
    { name: "Violet", color: { r: 0.545, g: 0.361, b: 0.965 } }
  ];

  for (const c of colors) {
    const circle = await callTool("create_frame", {
      parentId: paletteRow.nodeId,
      name: `Color: ${c.name}`,
      width: 44,
      height: 44
    });
    await callTool("set_corner_radius", { nodeId: circle.nodeId, radius: 22 });
    await callTool("set_fills", { nodeId: circle.nodeId, fills: [{ type: "SOLID", color: c.color }] });
  }

  // Action Buttons
  const editButtonsRow = await callTool("create_frame", { parentId: editScreen.nodeId, name: "Action Buttons" });
  await callTool("set_auto_layout", {
    nodeId: editButtonsRow.nodeId,
    layoutMode: "HORIZONTAL",
    itemSpacing: 12
  });
  await callTool("set_fills", { nodeId: editButtonsRow.nodeId, fills: [] });

  await callTool("create_instance", { componentId: "2:38", parentId: editButtonsRow.nodeId });
  await callTool("create_instance", { componentId: components["Button-Secondary"], parentId: editButtonsRow.nodeId });

  // =========================================================================
  // SCREEN 4: Share & Social Card Export (x: 1320, y: 0)
  // =========================================================================
  console.log("=== Assembling Screen 4: Share & Social Card Export ===");
  const shareScreen = await callTool("create_frame", {
    name: "📱 Screen 4: Share & Export",
    x: 1320,
    y: 0,
    width: 393,
    height: 852
  });
  await callTool("set_auto_layout", {
    nodeId: shareScreen.nodeId,
    layoutMode: "VERTICAL",
    paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24,
    itemSpacing: 20,
    primaryAxisAlignItems: "SPACE_BETWEEN"
  });
  await callTool("set_fills", {
    nodeId: shareScreen.nodeId,
    fills: [{ type: "SOLID", color: { r: 0.05, g: 0.08, b: 0.14 } }]
  });
  await bindColor(shareScreen.nodeId, "color/surface/background");

  // Top Area
  const shareTopArea = await callTool("create_frame", { parentId: shareScreen.nodeId, name: "Top Content" });
  await callTool("set_auto_layout", {
    nodeId: shareTopArea.nodeId,
    layoutMode: "VERTICAL",
    itemSpacing: 16
  });
  await callTool("set_fills", { nodeId: shareTopArea.nodeId, fills: [] });

  const shareHeader = await callTool("create_text", { parentId: shareTopArea.nodeId, characters: "Share Milestone Card" });
  await applyText(shareHeader.nodeId, "Headline/Screen");
  await bindColor(shareHeader.nodeId, "color/text/primary");

  // 9:16 Social Story Poster Card
  const posterCard = await callTool("create_frame", {
    parentId: shareTopArea.nodeId,
    name: "9:16 Social Story Export Frame",
    width: 345,
    height: 480
  });
  await callTool("set_auto_layout", {
    nodeId: posterCard.nodeId,
    layoutMode: "VERTICAL",
    paddingTop: 48, paddingBottom: 48, paddingLeft: 32, paddingRight: 32,
    itemSpacing: 20,
    primaryAxisAlignItems: "SPACE_BETWEEN", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_corner_radius", { nodeId: posterCard.nodeId, radius: 28 });
  await callTool("set_fills", {
    nodeId: posterCard.nodeId,
    fills: [{
      type: "GRADIENT_LINEAR",
      gradientStops: [
        { position: 0, color: { r: 0.1, g: 0.25, b: 0.7, a: 1 } },
        { position: 1, color: { r: 0.45, g: 0.15, b: 0.85, a: 1 } }
      ],
      gradientTransform: [[1, 0, 0], [0, 1, 0]]
    }]
  });

  const posterAppBrand = await callTool("create_text", { parentId: posterCard.nodeId, characters: "DAYS THAT MATTER" });
  await applyText(posterAppBrand.nodeId, "Label/Small");
  await callTool("set_fills", { nodeId: posterAppBrand.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });

  // Center Content
  const posterCenter = await callTool("create_frame", { parentId: posterCard.nodeId, name: "Center Countdown" });
  await callTool("set_auto_layout", {
    nodeId: posterCenter.nodeId,
    layoutMode: "VERTICAL",
    itemSpacing: 8,
    primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER"
  });
  await callTool("set_fills", { nodeId: posterCenter.nodeId, fills: [] });

  const posterNumber = await callTool("create_text", { parentId: posterCenter.nodeId, characters: "42" });
  await applyText(posterNumber.nodeId, "Display/Hero");
  await callTool("set_fills", { nodeId: posterNumber.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });

  const posterDaysLabel = await callTool("create_text", { parentId: posterCenter.nodeId, characters: "DAYS REMAINING" });
  await applyText(posterDaysLabel.nodeId, "Label/Button");
  await callTool("set_fills", { nodeId: posterDaysLabel.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });

  const posterTitle = await callTool("create_text", { parentId: posterCenter.nodeId, characters: "Trip to Tokyo & Kyoto" });
  await applyText(posterTitle.nodeId, "Headline/Screen");
  await callTool("set_fills", { nodeId: posterTitle.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });

  const posterWatermark = await callTool("create_text", { parentId: posterCard.nodeId, characters: "daysthatmatter.app/e/tokyo2026" });
  await applyText(posterWatermark.nodeId, "Label/Small");
  await callTool("set_fills", { nodeId: posterWatermark.nodeId, fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] });

  // Share Actions Bottom Row
  const shareActions = await callTool("create_frame", { parentId: shareScreen.nodeId, name: "Share Actions Row" });
  await callTool("set_auto_layout", {
    nodeId: shareActions.nodeId,
    layoutMode: "VERTICAL",
    itemSpacing: 12
  });
  await callTool("set_fills", { nodeId: shareActions.nodeId, fills: [] });
  await callTool("set_layout_props", { nodeId: shareActions.nodeId, layoutSizingHorizontal: "FILL" });

  await callTool("create_instance", { componentId: "2:38", parentId: shareActions.nodeId });
  await callTool("create_instance", { componentId: components["Button-Secondary"], parentId: shareActions.nodeId });

  console.log("=== All 4 Screens & Shared Components built successfully! ===");
}

main().catch(console.error);
