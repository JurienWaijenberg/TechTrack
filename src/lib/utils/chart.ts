import type { RaceSession } from '../types/f1';

interface DriverDataPoint {
    raceIndex: number;
    points: number;
}

export interface DriverData {
    driverName: string;
    data: DriverDataPoint[];
}

export interface ChartData {
    driverData: DriverData[];
    raceLabels: string[];
}

/**
 * Transform race sessions into driver points data for the chart
 * Uses cumulative points (championship standings)
 */
export function transformToChartData(raceSessions: RaceSession[]): ChartData {
    if (raceSessions.length === 0) {
        return { driverData: [], raceLabels: [] };
    }
    
    // Collect points per driver per race
    const driverPointsMap = new Map<number, number[]>();
    const driverInfoMap = new Map<number, { name: string; number: number }>();
    const raceLabels: string[] = [];
    
    raceSessions.forEach((session, raceIndex) => {
        const raceName = session.meeting_name ?? session.circuit_short_name ?? `Race ${raceIndex + 1}`;
        raceLabels.push(raceName);
        
        if (session.results && session.results.length > 0) {
            session.results.forEach(result => {
                const driverNumber = result.driver_number;
                if (driverNumber === undefined) return;
                
                // Initialize driver if not seen before
                if (!driverPointsMap.has(driverNumber)) {
                    driverPointsMap.set(driverNumber, new Array(raceSessions.length).fill(0));
                    driverInfoMap.set(driverNumber, {
                        name: result.full_name ?? `Driver ${driverNumber}`,
                        number: driverNumber
                    });
                }
                
                // Store points for this race
                const points = typeof result.points === 'number' ? result.points : 0;
                const pointsArray = driverPointsMap.get(driverNumber)!;
                pointsArray[raceIndex] = points;
            });
        }
    });
    
    // Convert to cumulative points (championship standings)
    const driverData = Array.from(driverPointsMap.entries())
        .map(([driverNumber, pointsArray]) => {
            const driverInfo = driverInfoMap.get(driverNumber)!;
            let cumulativePoints = 0;
            
            // Ensure pointsArray has the same length as raceSessions
            const paddedPointsArray = new Array(raceSessions.length).fill(0);
            pointsArray.forEach((points, idx) => {
                if (idx < paddedPointsArray.length) {
                    paddedPointsArray[idx] = points;
                }
            });
            
            // Create data points with cumulative points
            const data = paddedPointsArray.map((points, raceIndex) => {
                cumulativePoints += points;
                return {
                    raceIndex,
                    points: cumulativePoints
                };
            });
            
            return {
                driverName: driverInfo.name,
                data
            };
        })
        .filter(driver => driver.data.length > 0);
    
    return {
        driverData,
        raceLabels
    };
}

