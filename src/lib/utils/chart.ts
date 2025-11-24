import type { RaceSession, Driver } from '../types/f1';

interface DriverDataPoint {
    raceIndex: number;
    points: number;
}

export interface DriverData {
    driverName: string;
    teamColour?: string;
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
export function transformToChartData(raceSessions: RaceSession[], drivers: Driver[] = []): ChartData {
    if (raceSessions.length === 0) {
        return { driverData: [], raceLabels: [] };
    }
    
    // Create mapping from driver_number to last_name and team_colour using drivers data
    const driverNumberToLastName = new Map<number, string>();
    const driverNumberToTeamColour = new Map<number, string>();
    drivers.forEach(driver => {
        if (driver.driver_number !== undefined) {
            if (driver.last_name) {
                driverNumberToLastName.set(driver.driver_number, driver.last_name);
            }
            if (driver.team_colour) {
                driverNumberToTeamColour.set(driver.driver_number, driver.team_colour);
            }
        }
    });
    
    // Collect points per driver per race
    const driverPointsMap = new Map<number, number[]>();
    const driverInfoMap = new Map<number, { name: string; number: number; teamColour?: string }>();
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
                    // Get last name from drivers mapping, fallback to extracting from full_name
                    const lastName = driverNumberToLastName.get(driverNumber) 
                        || (result.full_name ? (result.full_name.split(/\s+/).pop() || `Driver ${driverNumber}`) : `Driver ${driverNumber}`);
                    const teamColour = driverNumberToTeamColour.get(driverNumber);
                    driverInfoMap.set(driverNumber, {
                        name: lastName,
                        number: driverNumber,
                        teamColour
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
                teamColour: driverInfo.teamColour,
                data
            };
        })
        .filter(driver => driver.data.length > 0);
    
    return {
        driverData,
        raceLabels
    };
}

