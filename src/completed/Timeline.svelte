<script lang="ts">
    import * as d3 from "d3";
    
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
  
    interface Props {
        driverData?: DriverData[];
        raceLabels?: string[];
        label?: string;
    }
  
    let { driverData = [], raceLabels = [], label = "Points" }: Props = $props();
  
    let containerElement: HTMLDivElement;
    let width = $state(800);
    let height = $state(300);
  
    const margins = {
      marginTop: 40,
      marginRight: 30,
      marginBottom: 40,
      marginLeft: 75
    };
    
    const boundedWidth = $derived(Math.max(width - margins.marginLeft - margins.marginRight, 0));
    const boundedHeight = $derived(Math.max(height - margins.marginTop - margins.marginBottom, 0));
  
    // Get all points to determine y-axis domain
    const allPoints = $derived(driverData.flatMap((driver: DriverData) => driver.data.map((d: DriverDataPoint) => d.points || 0)));
    const maxPoints = $derived(allPoints.length > 0 ? Math.max(...allPoints) : 0);
  
    // X-axis: scale for race labels
    const xScale = $derived(d3.scalePoint<string>()
      .domain(raceLabels.length > 0 ? raceLabels : [])
      .range([0, boundedWidth])
      .padding(0.1));
  
    // Y-axis: scale for points
    const yScale = $derived(d3.scaleLinear()
      .domain([0, Math.max(maxPoints, 1)])
      .range([boundedHeight, 0])
      .nice());
    
    // Generate line paths for each driver
    const lineGenerator = $derived(d3.line<DriverDataPoint>()
      .x((d) => {
        const raceIdx = d.raceIndex ?? 0;
        const raceLabel = raceLabels[raceIdx];
        if (!raceLabel) {
          console.warn(`No race label for index ${raceIdx}`);
          return 0;
        }
        const xValue = xScale(raceLabel);
        if (xValue === undefined) {
          console.warn(`xScale returned undefined for "${raceLabel}"`);
          return 0;
        }
        return xValue;
      })
      .y((d) => yScale(d.points || 0))
      .curve(d3.curveMonotoneX));
    
    // X-axis ticks
    const xTicks = $derived(xScale.domain());
    
    // Y-axis ticks
    const yTicks = $derived(yScale.ticks(5));
    
    // Format function for x-axis ticks
    function formatRaceTick(d: string): string {
      return d.length > 10 ? d.substring(0, 10) + '...' : d;
    }
    
    // Update dimensions when container size changes
    $effect(() => {
      if (containerElement && typeof window !== 'undefined') {
        const updateDimensions = () => {
          width = containerElement.clientWidth || 800;
          height = 300;
        };
        
        updateDimensions();
        const resizeObserver = new ResizeObserver(updateDimensions);
        resizeObserver.observe(containerElement);
        
        return () => resizeObserver.disconnect();
      }
    });
</script>

<div class="Timeline" bind:this={containerElement}>
  <svg class="Chart" width={width} height={height}>
    <g transform={`translate(${margins.marginLeft}, ${margins.marginTop})`}>
      
      <!-- X-axis line -->
      <line
        class="Axis__line Axis__line--x"
        x1="0"
        y1={boundedHeight}
        x2={boundedWidth}
        y2={boundedHeight}
      />
      
      <!-- X-axis ticks and labels -->
      {#each xTicks as tick}
        {@const xValue = xScale(tick)}
        {#if xValue !== undefined}
          <g class="Axis__tick Axis__tick--x" transform={`translate(${xValue}, ${boundedHeight})`}>
            <line y2="6" stroke="#bdc3c7" />
            <text y="20" text-anchor="middle" fill="#fff" font-size="0.9em">
              {formatRaceTick(tick)}
            </text>
          </g>
        {/if}
      {/each}
      
      <!-- Y-axis line -->
      <line
        class="Axis__line Axis__line--y"
        x1="0"
        y1="0"
        x2="0"
        y2={boundedHeight}
      />
      
      <!-- Y-axis ticks and labels -->
      {#each yTicks as tick}
        {@const yValue = yScale(tick)}
        <g class="Axis__tick Axis__tick--y" transform={`translate(0, ${yValue})`}>
          <line x2="-6" stroke="#bdc3c7" />
          <text x="-10" text-anchor="end" fill="#fff" font-size="0.9em" dominant-baseline="middle">
            {tick}
          </text>
        </g>
      {/each}
      
      <!-- Y-axis label -->
      {#if label}
        <text
          class="Axis__label Axis__label--y"
          x="-40"
          y={boundedHeight / 2}
          text-anchor="middle"
          fill="#fff"
          font-size="0.8em"
          transform="rotate(-90, -40, {boundedHeight / 2})"
        >
          {label}
        </text>
      {/if}
      
      <!-- Driver lines -->
      {#each driverData as driver, driverIndex}
        {@const color = driverColors[driverIndex % driverColors.length]}
        {@const linePath = lineGenerator(driver.data)}
        {#if linePath}
          <path
            class="Line"
            d={linePath}
            fill="none"
            stroke={color}
            stroke-width="2"
            stroke-linecap="round"
          />
        {/if}
      {/each}
      
    </g>
  </svg>
</div>

<style>
  .Timeline {
    height: 300px;
    min-width: 500px;
    width: calc(100% + 1em);
    margin-bottom: 2em;
  }
  
  .Chart {
    display: block;
  }
  
  .Axis__line {
    stroke: #bdc3c7;
  }
  
  .Axis__tick {
    font-size: 0.9em;
  }
  
  .Axis__tick--x text {
    fill: #fff;
  }
  
  .Axis__tick--y text {
    fill: #fff;
  }
  
  .Axis__label {
    font-size: 0.8em;
    letter-spacing: 0.01em;
  }
  
  .Line {
    transition: all 0.3s ease-out;
  }
</style>
