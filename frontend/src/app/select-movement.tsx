import { View, Text, Pressable, FlatList } from 'react-native';
import { router } from 'expo-router';
import { MOVEMENTS } from '../constants/movements';
import { ui } from '../constants/theme';

export default function SelectMovement() {
  return (
    <View style={ui.screen}>
      <FlatList
        data={MOVEMENTS}
        keyExtractor={m => m.id}
        renderItem={({ item }) => (
          <Pressable style={ui.card} onPress={() => router.push({ pathname: '/capture', params: { movement: item.id } })}>
            <Text style={[ui.text, { fontWeight: '600' }]}>{item.name}</Text>
            <Text style={ui.muted}>{item.view}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}