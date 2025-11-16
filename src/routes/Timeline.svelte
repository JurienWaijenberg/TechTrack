<script>
    import * as d3 from "d3";
  
    import Chart from "../chart/Chart.svelte";
    import Line from "../chart/Line.svelte";
    import Axis from "../chart/Axis-naive.svelte";
  
    const formatDate = d3.timeFormat("%-b %-d");
  
    export let data = [];
    export let xAccessor = d => d.x;
    export let yAccessor = d => d.y;
    export let label;
  
  </script>
  
  <div class="Timeline placeholder">
  </div>
  
  <style>
    .Timeline {
      height: 300px;
      min-width: 500px;
      width: calc(100% + 1em);
      margin-bottom: 2em;
    }
  </style>
  