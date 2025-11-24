<script lang="ts">
    import * as d3 from "d3";
    import { getTeamColour } from '$lib/utils/format';
  
    interface DriverDataPoint {
        raceIndex: number;
        points: number;
    }
    
    interface DriverData {
        driverName: string;
        teamColour?: string;
        data: DriverDataPoint[];
    }
  
    interface Props {
        driverData?: DriverData[];
        raceLabels?: string[];
        label?: string;
    }
  
    let { driverData = [], raceLabels = [], label = "Points" }: Props = $props();
  
    let containerElement: HTMLDivElement;
    let svgElement: SVGSVGElement;
    let width = $state(800);
    let height = $state(500);
  
    // Tooltip state
    let tooltipVisible = $state(false);
    let tooltipX = $state(0);
    let tooltipY = $state(0);
    let tooltipDriver: { name: string; points: number; race: string } | null = $state(null);
  
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
    
    // Find closest data point to mouse position
    function findClosestPoint(mouseX: number, mouseY: number): { driver: DriverData; point: DriverDataPoint; raceLabel: string } | null {
      let closest: { driver: DriverData; point: DriverDataPoint; raceLabel: string; distance: number } | null = null;
      
      for (const driver of driverData) {
        for (const point of driver.data) {
          const raceIdx = point.raceIndex ?? 0;
          const raceLabel = raceLabels[raceIdx] || '';
          const xValue = xScale(raceLabel);
          
          if (xValue === undefined) continue;
          
          const yValue = yScale(point.points || 0);
          const distance = Math.sqrt(Math.pow(mouseX - xValue, 2) + Math.pow(mouseY - yValue, 2));
          
          if (!closest || distance < closest.distance) {
            closest = { driver, point, raceLabel, distance };
          }
        }
      }
      
      // Only return if within reasonable distance (50px)
      if (closest && closest.distance < 50) {
        return { driver: closest.driver, point: closest.point, raceLabel: closest.raceLabel };
      }
      
      return null;
    }
    
    // Handle mouse move on SVG
    function handleMouseMove(event: MouseEvent) {
      if (!svgElement) return;
      
      const rect = svgElement.getBoundingClientRect();
      const mouseX = event.clientX - rect.left - margins.marginLeft;
      const mouseY = event.clientY - rect.top - margins.marginTop;
      
      // Only show tooltip if within bounds
      if (mouseX < 0 || mouseX > boundedWidth || mouseY < 0 || mouseY > boundedHeight) {
        tooltipVisible = false;
        return;
      }
      
      const closest = findClosestPoint(mouseX, mouseY);
      
      if (closest) {
        tooltipX = event.clientX;
        tooltipY = event.clientY;
        tooltipDriver = {
          name: closest.driver.driverName,
          points: closest.point.points,
          race: closest.raceLabel
        };
        tooltipVisible = true;
      } else {
        tooltipVisible = false;
      }
    }
    
    function handleMouseLeave() {
      tooltipVisible = false;
      tooltipDriver = null;
    }
    
    // Update dimensions when container size changes
    $effect(() => {
      if (containerElement && typeof window !== 'undefined') {
        const updateDimensions = () => {
          width = containerElement.clientWidth || 800;
          height = 500;
        };
        
        updateDimensions();
        const resizeObserver = new ResizeObserver(updateDimensions);
        resizeObserver.observe(containerElement);
        
        return () => resizeObserver.disconnect();
      }
    });
</script>

<div class="Timeline" bind:this={containerElement}>
  <svg 
    class="Chart" 
    width={width} 
    height={height}
    bind:this={svgElement}
    role="img"
    aria-label="F1 Driver Points Championship Chart"
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
  >
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
            <text y="20" text-anchor="middle" fill="#fff" font-size="0.9em" transform="rotate(25) translate(30, 0)">
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
        {@const color = getTeamColour(driver.teamColour)}
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
  
  <!-- Tooltip -->
  {#if tooltipVisible && tooltipDriver}
    <div 
      class="tooltip"
      style="left: {tooltipX}px; top: {tooltipY}px;"
    >
      <div class="tooltip__driver">{tooltipDriver.name}</div>
      <div class="tooltip__race">{tooltipDriver.race}</div>
      <div class="tooltip__points">{tooltipDriver.points} points</div>
    </div>
  {/if}
</div>

<style>
  .Timeline {
    height: 500px;
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
    cursor: pointer;
  }
  
  .Line:hover {
    stroke-width: 3;
    opacity: 0.9;
  }
  
  .tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 0.9);
    color: #fff;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    pointer-events: none;
    z-index: 1000;
    transform: translate(-50%, -100%);
    margin-top: -10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    min-width: 150px;
  }
  
  .tooltip__driver {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.25rem;
    color: #FFD166;
  }
  
  .tooltip__race {
    font-size: 0.85rem;
    opacity: 0.8;
    margin-bottom: 0.25rem;
  }
  
  .tooltip__points {
    font-size: 0.9rem;
    font-weight: 500;
    color: #4ECDC4;
  }
</style>
