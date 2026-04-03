import { useState, useEffect, useMemo } from 'react';

export function useMenuTime(estabelecimentoInfo) {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const isLojaAberta = useMemo(() => {
        if (!estabelecimentoInfo) return false;
        const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        const diaKey = dias[currentTime.getDay()];
        const diaAnteriorKey = dias[(currentTime.getDay() + 6) % 7];

        const calcTempo = (str) => {
            const [h, m] = str.split(':').map(Number);
            return h * 60 + (m || 0);
        };

        const verificar = (abertura, fechamento) => {
            try {
                const agora = currentTime.getHours() * 60 + currentTime.getMinutes();
                const abre = calcTempo(abertura);
                const fecha = calcTempo(fechamento);
                if (abre === fecha) return true;
                return abre < fecha ? (agora >= abre && agora <= fecha) : (agora >= abre || agora <= fecha);
            } catch { return true; }
        };

        const checarTurnoAnterior = () => {
            if (estabelecimentoInfo.horariosFuncionamento) {
                const configOntem = estabelecimentoInfo.horariosFuncionamento[diaAnteriorKey];
                if (!configOntem?.ativo || !configOntem.abertura || !configOntem.fechamento) return false;
                const abreOntem = calcTempo(configOntem.abertura);
                const fechaOntem = calcTempo(configOntem.fechamento);
                if (fechaOntem < abreOntem) {
                    const agoraMin = currentTime.getHours() * 60 + currentTime.getMinutes();
                    return agoraMin <= fechaOntem;
                }
            }
            return false;
        };

        if (estabelecimentoInfo.horariosFuncionamento) {
            const config = estabelecimentoInfo.horariosFuncionamento[diaKey];
            if (config?.ativo) return verificar(config.abertura, config.fechamento);
            return checarTurnoAnterior();
        }
        if (estabelecimentoInfo.horaAbertura && estabelecimentoInfo.horaFechamento) {
            return verificar(estabelecimentoInfo.horaAbertura, estabelecimentoInfo.horaFechamento);
        }
        return true;
    }, [estabelecimentoInfo, currentTime]);

    return { currentTime, isLojaAberta };
}
