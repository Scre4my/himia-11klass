export type EvaporatorInstallation = {
  value: string;
  label: string;
  executions: {
    value: string;
    label: string;
    purpose: string;
  }[];
};

export const EVAPORATOR_INSTALLATIONS: EvaporatorInstallation[] = [
  {
    value: 'type-1-natural-circulation',
    label: 'Выпарные трубчатые аппараты с естественной циркуляцией',
    executions: [
      {
        value: 'type-1-execution-1',
        label: '1 - с соосной двухходовой греющей камерой',
        purpose: 'Упаривание растворов, не образующих осадка на греющих трубках, а также при незначительных накипеобразованиях на трубках, удаляемых промывкой',
      },
      {
        value: 'type-1-execution-2',
        label: '2 - с вынесенной греющей камерой',
        purpose: 'Упаривание растворов, выделяющих незначительный осадок, удаляемый механическим способом',
      },
      {
        value: 'type-1-execution-3',
        label: '3 - с соосной греющей камерой и солеотделением',
        purpose: 'Упаривание растворов, выделяющих кристаллы и образующих осадок, удаляемый промывкой',
      },
    ],
  },
  {
    value: 'type-2-forced-circulation',
    label: 'Выпарные трубчатые аппараты с принудительной циркуляцией',
    executions: [
      {
        value: 'type-2-execution-1',
        label: '1 - с вынесенной греющей камерой',
        purpose: 'Упаривание вязких растворов или выделяющих осадок на греющих трубках, удаляемый механическим способом',
      },
      {
        value: 'type-2-execution-2',
        label: '2 - с соосной греющей камерой',
        purpose: 'Упаривание вязких чистых растворов, не выделяющих осадков, а также при незначительных накипеобразованиях на трубках, удаляемых промывкой',
      },
    ],
  },
  {
    value: 'type-3-film',
    label: 'Выпарные трубчатые аппараты пленочные',
    executions: [
      {
        value: 'type-3-execution-1',
        label: '1 - с восходящей пленкой',
        purpose: 'Упаривание пенящихся растворов',
      },
      {
        value: 'type-3-execution-2',
        label: '2 - со стекающей пленкой',
        purpose: 'Упаривание вязких и термостойких растворов',
      },
    ],
  },
];

export const getInstallationByValue = (value: string) =>
  EVAPORATOR_INSTALLATIONS.find(item => item.value === value);

export const getExecutionByValue = (installationValue: string, executionValue?: string) =>
  getInstallationByValue(installationValue)?.executions.find(item => item.value === executionValue);
