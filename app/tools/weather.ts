import { tool } from 'ai';
import { z } from 'zod';

/**
 * Weather tool that provides current weather information for any city.
 * Returns realistic simulated weather data including temperature, conditions, and humidity.
 */
export const weatherTool = tool({
  description: 'Get the current weather in a location including temperature, conditions, and humidity',

  inputSchema: z.object({
    city: z.string().describe('The city name to get weather for (e.g., "San Francisco", "New York")'),
  }),

  execute: async ({ city }) => {
    // Simulate realistic weather data with some variation based on city
    const weatherConditions = [
      { condition: 'sunny', tempRange: [65, 85], humidityRange: [20, 45] },
      { condition: 'partly cloudy', tempRange: [60, 80], humidityRange: [30, 55] },
      { condition: 'cloudy', tempRange: [55, 75], humidityRange: [40, 65] },
      { condition: 'rainy', tempRange: [45, 70], humidityRange: [70, 90] },
      { condition: 'stormy', tempRange: [50, 75], humidityRange: [75, 95] },
      { condition: 'snowy', tempRange: [15, 35], humidityRange: [60, 80] },
    ];

    // Select weather condition based on city name hash for consistency
    const cityHash = city.toLowerCase().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const conditionIndex = cityHash % weatherConditions.length;
    const selectedWeather = weatherConditions[conditionIndex];

    // Generate temperature within the condition's range
    const temperature = Math.floor(
      Math.random() * (selectedWeather.tempRange[1] - selectedWeather.tempRange[0] + 1)
      + selectedWeather.tempRange[0]
    );

    // Generate humidity within the condition's range
    const humidity = Math.floor(
      Math.random() * (selectedWeather.humidityRange[1] - selectedWeather.humidityRange[0] + 1)
      + selectedWeather.humidityRange[0]
    );

    // Determine feels-like temperature (affected by humidity)
    let feelsLike = temperature;
    if (humidity > 70 && temperature > 70) {
      feelsLike = temperature + 3; // Heat index effect
    } else if (humidity > 60 && temperature < 50) {
      feelsLike = temperature - 2; // Wind chill effect
    }

    // Generate additional weather data
    const windSpeed = Math.floor(Math.random() * 20) + 5; // 5-25 mph
    const visibility = selectedWeather.condition === 'rainy' || selectedWeather.condition === 'stormy'
      ? Math.floor(Math.random() * 5) + 1 // 1-5 miles
      : Math.floor(Math.random() * 5) + 8; // 8-12 miles

    const uvIndex = selectedWeather.condition === 'sunny'
      ? Math.floor(Math.random() * 5) + 6 // 6-11 (high to extreme)
      : selectedWeather.condition === 'partly cloudy'
      ? Math.floor(Math.random() * 3) + 3 // 3-5 (moderate)
      : Math.floor(Math.random() * 2) + 1; // 1-2 (low)

    return {
      city: city.trim(),
      temperature,
      feelsLike,
      condition: selectedWeather.condition,
      humidity,
      windSpeed,
      windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
      visibility,
      uvIndex,
      pressure: Math.floor(Math.random() * 50) + 980, // 980-1030 mb
      dewPoint: temperature - Math.floor((100 - humidity) / 5),
      timestamp: new Date().toISOString(),
      description: getWeatherDescription(selectedWeather.condition, temperature, humidity),
    };
  },
});

/**
 * Generate human-readable weather description
 */
function getWeatherDescription(condition: string, temperature: number, humidity: number): string {
  const tempDescription = temperature < 32 ? 'Freezing' :
                         temperature < 50 ? 'Cold' :
                         temperature < 65 ? 'Cool' :
                         temperature < 80 ? 'Warm' : 'Hot';

  const conditionDescriptions = {
    'sunny': ['Clear skies', 'Plenty of sunshine', 'Bright and clear'],
    'partly cloudy': ['Partly sunny', 'Mix of sun and clouds', 'Scattered clouds'],
    'cloudy': ['Overcast', 'Mostly cloudy', 'Gray skies'],
    'rainy': ['Rain showers', 'Light rain', 'Wet conditions'],
    'stormy': ['Thunderstorms', 'Heavy rain', 'Stormy weather'],
    'snowy': ['Snow showers', 'Light snow', 'Wintry precipitation'],
  };

  const conditionDesc = conditionDescriptions[condition][Math.floor(Math.random() * 3)];
  const humidityDesc = humidity > 70 ? 'and humid' : humidity < 30 ? 'and dry' : 'with comfortable humidity';

  return `${tempDescription} with ${conditionDesc.toLowerCase()} ${humidityDesc}.`;
}