<script lang="ts">
    import * as d3 from "d3";
  
    import Chart from "./Chart/Chart.svelte";
    import Line from "./Chart/Line.svelte";
    import Axis from "./Chart/Axis.svelte";
    
    // Color scheme for driver lines
    const driverColors = [
      "#9980fa", "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A",
      "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739",
      "#52BE80", "#E74C3C", "#3498DB", "#9B59B6", "#1ABC9C",
      "#F39C12", "#E67E22", "#34495E", "#16A085", "#27AE60"
    ];
  
    interface DriverDataPoint {
        raceIndex: number;
        points: number;
    }
    
    interface DriverData {
        driverName: string;
        data: DriverDataPoint[];
    }
  
    export let driverData: DriverData[] = [];
    export let raceLabels: string[] = [];
    export let label = "Points";
  
    let width = 100;
    let height = 100;
  
    const margins = {
      marginTop: 40,
      marginRight: 30,
      marginBottom: 40,
      marginLeft: 75
    };
    $: dms = {
      width,
      height,
      ...margins,
      boundedHeight: Math.max(
        height - margins.marginTop - margins.marginBottom,
        0
      ),
      boundedWidth: Math.max(
        width - margins.marginLeft - margins.marginRight,
        0
      )
    };
  
    // Get all points to determine y-axis domain
    $: allPoints = driverData.flatMap((driver: DriverData) => driver.data.map((d: DriverDataPoint) => d.points || 0));
    $: maxPoints = allPoints.length > 0 ? Math.max(...allPoints) : 0;
  
    // X-axis: scale for race indices
    $: xScale = d3.scalePoint<string>()
      .domain(raceLabels.length > 0 ? raceLabels : driverData[0]?.data.map((_: DriverDataPoint, i: number) => String(i)) || [])
      .range([0, dms.boundedWidth])
      .padding(0.1);
  
    // Y-axis: scale for points
    $: yScale = d3.scaleLinear()
      .domain([0, Math.max(maxPoints, 1)])
      .range([dms.boundedHeight, 0])
      .nice();
  
    // Format function for x-axis ticks
    $: formatRaceTick = (d: any) => {
      if (typeof d === 'string') return d.length > 10 ? d.substring(0, 10) + '...' : d;
      return String(d);
    };
  </script>
  
  <div class="Timeline placeholder" bind:clientWidth={width} bind:clientHeight={height}>
    <Chart dimensions={dms}>
      <Axis
        dimension="x"
        scale={xScale}
        formatTick={formatRaceTick}
        label=""
      />
      <Axis
        dimension="y"
        scale={yScale}
        label={label}
      />
      {#each driverData as driver, driverIndex}
        {@const color = driverColors[driverIndex % driverColors.length]}
        {@const xAccessorScaled = (d: any) => {
          const raceLabel = raceLabels[d.raceIndex] ?? String(d.raceIndex);
          return xScale(raceLabel) ?? 0;
        }}
        {@const yAccessorScaled = (d: any) => yScale(d.points || 0) ?? 0}
        <Line
          data={driver.data}
          xAccessor={xAccessorScaled}
          yAccessor={yAccessorScaled}
          style="stroke: {color}; stroke-width: 2px; fill: none;"
        />
      {/each}
    </Chart>
  </div>
  
  <style>
    .Timeline {
      height: 300px;
      min-width: 500px;
      width: calc(100% + 1em);
      margin-bottom: 2em;
    }
  </style>
  