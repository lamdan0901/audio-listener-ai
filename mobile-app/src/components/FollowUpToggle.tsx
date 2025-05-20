import React from "react";
import { View, Text, Switch } from "react-native";
import { styles, theme } from "../screens/MainScreen.style";

interface FollowUpToggleProps {
  isFollowUp: boolean;
  setIsFollowUp: React.Dispatch<React.SetStateAction<boolean>>;
  canFollowUp: boolean;
}

const FollowUpToggle: React.FC<FollowUpToggleProps> = ({
  isFollowUp,
  setIsFollowUp,
  canFollowUp,
}) => {
  return (
    <View style={[styles.section, styles.switchContainer]}>
      <Text style={canFollowUp ? styles.activeText : styles.disabledText}>
        Ask a follow-up question
      </Text>
      <Switch
        value={isFollowUp}
        onValueChange={(value) => setIsFollowUp(value)}
        disabled={!canFollowUp}
        trackColor={{
          false: theme.colors.secondary,
          true: theme.colors.primaryLight,
        }}
        thumbColor={isFollowUp ? theme.colors.primary : "#f4f3f4"}
        ios_backgroundColor={theme.colors.borderLight}
      />
    </View>
  );
};

export default FollowUpToggle;
