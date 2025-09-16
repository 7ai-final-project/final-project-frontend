import { Stack, SplashScreen } from "expo-router";
import { useFonts } from "expo-font";
import { useEffect } from "react";

// 폰트 로딩이 완료될 때까지 기본 로딩 화면(스플래시 스크린)이 사라지지 않도록 합니다.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // 1. 'neodgm'이라는 이름으로 실제 폰트 파일을 불러옵니다.
  // fontsLoaded: 로딩 완료 여부 (true/false)
  // fontError: 로딩 중 에러 발생 여부
  const [fontsLoaded, fontError] = useFonts({
    // 'neodgm'은 우리가 앱 전체에서 사용할 폰트의 별명입니다.
    // require 안의 경로는 실제 폰트 파일 위치에 맞게 수정해야 할 수 있습니다.
    neodgm: require("../assets/fonts/neodgm.ttf"),
  });

  // 2. 폰트 로딩 상태가 바뀔 때마다 실행됩니다.
  useEffect(() => {
    // 폰트 로딩이 성공했거나, 또는 에러가 발생했다면,
    if (fontsLoaded || fontError) {
      // 더 이상 기다릴 필요가 없으므로 로딩 화면을 숨깁니다.
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // 3. 폰트 로딩이 아직 진행 중이고, 에러도 없는 상태라면...
  //    아무것도 렌더링하지 않고 잠시 기다립니다. (null을 반환)
  //    이 덕분에 폰트가 깨진 화면이 사용자에게 보이지 않습니다.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  // 4. 폰트 로딩이 완료되면, 비로소 기존의 화면들을 렌더링합니다.
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{ headerShown: false }} />
      <Stack.Screen name="game" options={{ headerShown: false }} />
      <Stack.Screen name="image_gen" options={{ headerShown: false }} />
      <Stack.Screen name="storymode" options={{ headerShown: false }} />
    </Stack>
  );
}
