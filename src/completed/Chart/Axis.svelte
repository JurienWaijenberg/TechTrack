<script lang="ts">
    import { getContext } from "svelte";
    import * as d3 from "d3";
  
    export let dimension = "x";
    export let scale: any = null;
    export let label: string | undefined = undefined;
    export let formatTick = d3.format(",");
  
    const { dimensions: dimensionsStore } = getContext("Chart") as { dimensions: any };
    $: dimensions = $dimensionsStore;
  
    $: numberOfTicks =
      dimension == "x"
        ? dimensions.boundedWidth < 600
          ? dimensions.boundedWidth / 100
          : dimensions.boundedWidth / 250
        : dimensions.boundedHeight / 70;
  
    // Handle both continuous scales (with ticks method) and ordinal/point scales (with domain)
    $: ticks = scale && typeof scale.ticks === 'function' 
      ? scale.ticks(numberOfTicks)
      : (scale && typeof scale.domain === 'function' ? scale.domain() : []);
  </script>
  
  <g
    class="Axis Axis--dimension-{dimension}" 
    transform={`translate(0, ${dimension == "x" ? dimensions.boundedHeight : 0})`}>
    <line
      class="Axis__line"
      x2={dimension == "x" ? dimensions.boundedWidth : 0}
      y2={dimension == "y" ? dimensions.boundedHeight : 0}
    />
  
    {#each ticks as tick, i}
      {@const tickValue = scale && typeof scale === 'function' ? scale(tick) : 0}
      <text class="Axis__tick" style="fill: #fff;" transform={`translate(${(
        dimension == "x"
          ? [tickValue, 35]
          : [-16, tickValue]
        ).join(", ")})`}>
        {formatTick(tick)}
      </text>
    {/each}
  
    {#if label}
      <text
        class="Axis__label"
        style="fill: #fff; transform: translate({(
          dimension == "x"
            ? [dimensions.boundedWidth / 2, 60]
            : [-56, dimensions.boundedHeight / 2]
        ).map(d => d + "px").join(", ")}) {
          dimension == "y" ? "rotate(-90deg)" : ""
        }">
        {label}
      </text>
    {/if}
  </g>
  
  <style>
    .Axis__line {
      stroke: #bdc3c7;
    }
  
    .Axis__label {
      text-anchor: middle;
      font-size: 0.8em;
      letter-spacing: 0.01em;
    }
  
    .Axis__tick {
      font-size: 0.9em;
      transition: all 0.3s ease-out;
    }
  
    .Axis--dimension-x .Axis__tick {
      text-anchor: middle;
    }
  
    .Axis--dimension-y .Axis__tick {
      dominant-baseline: middle;
      text-anchor: end;
    }

    .Axis--dimension-x .Axis__tick text {
      transform: rotate(25deg);
    }
  </style>
  