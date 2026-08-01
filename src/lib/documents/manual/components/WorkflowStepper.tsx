import { View, Text, Svg, Path } from '@react-pdf/renderer'
import { COLORS, FONT } from '../styles'

interface Step {
  label: string
  detail?: string
}

function Arrow() {
  return (
    <View style={{ width: 20, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
      <Svg width={16} height={10} viewBox="0 0 16 10">
        <Path d="M0,5 L13,5 M8,1 L13,5 L8,9" stroke={COLORS.slate300} strokeWidth={1.5} fill="none" />
      </Svg>
    </View>
  )
}

/**
 * The numbered horizontal workflow stepper (e.g. "Create PO -> Receive
 * Items -> Inventory Updates -> Movement Recorded"). Renders as a single
 * wrap={false} row when it fits comfortably (2-4 steps, the common case);
 * with more steps it still lays out via flexWrap so long sequences don't
 * overflow the page width.
 */
export function WorkflowStepper({ steps }: { steps: Step[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginVertical: 12 }}>
      {steps.map((step, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }} wrap={false}>
          <View style={{ width: 96, alignItems: 'center' }}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: COLORS.obsidian,
                borderWidth: 1.5,
                borderColor: COLORS.teal,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 6,
              }}
            >
              <Text style={{ fontSize: 10, fontFamily: FONT.bold, color: COLORS.teal }}>{i + 1}</Text>
            </View>
            <Text style={{ fontSize: 8.5, fontFamily: FONT.bold, color: COLORS.slate900, textAlign: 'center', marginBottom: step.detail ? 2 : 0 }}>{step.label}</Text>
            {step.detail && <Text style={{ fontSize: 7.5, color: COLORS.slate500, textAlign: 'center', lineHeight: 1.35 }}>{step.detail}</Text>}
          </View>
          {i < steps.length - 1 && <Arrow />}
        </View>
      ))}
    </View>
  )
}
