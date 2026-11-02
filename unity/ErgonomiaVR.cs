// ErgonomiaVR.cs — Treinamento "Levantamento seguro de cargas" em VR (Unity 6 + OpenXR)
// Braian Tech
//
// Como usar:
//  1. Importe trabalhador_treinamento.fbx (Rig: Generic) e galpao.fbx.
//  2. Coloque os dois na cena na origem (0,0,0). O XR Origin fica a uns 2,5 m do trabalhador.
//  3. Adicione este script ao objeto do trabalhador e arraste o clipe de animação no campo "clip".
//
// Controle direito:  A = reiniciar   |   B = câmera lenta liga/desliga
// Controle esquerdo: X = pular para o jeito certo
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;
using UnityEngine.XR;

[RequireComponent(typeof(Animator))]
public class ErgonomiaVR : MonoBehaviour
{
    [Header("Animação")]
    public AnimationClip clip;
    [Range(0.1f, 1f)] public float velocidadeLenta = 0.4f;
    public float duracaoCartela = 2.5f;

    [Header("Legenda flutuante")]
    public Vector3 posicaoLegenda = new Vector3(0f, 2.15f, -0.6f);
    public float tamanhoFonte = 0.9f;

    static readonly Color VERMELHO = new Color(1f, 0.25f, 0.25f);
    static readonly Color VERDE = new Color(0.13f, 0.77f, 0.37f);

    // Trechos do clipe (segundos) — os mesmos do vídeo
    struct Trecho { public float ini, fim; public bool certo; }
    static readonly Trecho[] Trechos =
    {
        new Trecho { ini = 3.5f,  fim = 11.0f, certo = false },
        new Trecho { ini = 13.0f, fim = 36.5f, certo = true },
    };

    static readonly (float t, string texto)[] Legendas =
    {
        (3.5f,  "Curvar a coluna com as pernas esticadas"),
        (7.4f,  "Levantar com as costas, carga longe do corpo\n<size=70%>Sobrecarga na lombar</size>"),
        (13.0f, "Antes: avalie o peso, o tamanho e a pega"),
        (14.0f, "1 · Afaste os pés na largura dos ombros"),
        (16.5f, "2 · Agache dobrando os joelhos — coluna reta"),
        (20.0f, "3 · Segure firme, com a carga junto ao corpo"),
        (22.5f, "4 · Levante com a força das pernas"),
        (26.0f, "5 · Carga junto ao corpo, na altura da cintura"),
        (28.0f, "6 · Para mudar de direção, gire com os pés"),
        (32.2f, "7 · Deposite a carga com controle"),
    };

    PlayableGraph graph;
    AnimationClipPlayable playable;
    TextMeshPro legenda;
    int trecho;
    float tempo;          // tempo dentro do clipe
    float cartela = -1f;  // >= 0 enquanto mostra a cartela entre os trechos
    bool lento, aAntes, bAntes, xAntes;
    readonly List<InputDevice> devices = new List<InputDevice>();

    void Start()
    {
        if (clip == null) { Debug.LogError("ErgonomiaVR: arraste o clipe no campo 'clip'."); enabled = false; return; }
        graph = PlayableGraph.Create("ErgonomiaVR");
        graph.SetTimeUpdateMode(DirectorUpdateMode.Manual);
        var output = AnimationPlayableOutput.Create(graph, "Anim", GetComponent<Animator>());
        playable = AnimationClipPlayable.Create(graph, clip);
        playable.SetApplyFootIK(false);
        output.SetSourcePlayable(playable);
        graph.Play();

        var go = new GameObject("LegendaVR");
        go.transform.SetParent(transform.parent, false);
        go.transform.position = transform.TransformPoint(posicaoLegenda);
        legenda = go.AddComponent<TextMeshPro>();
        legenda.fontSize = tamanhoFonte;
        legenda.alignment = TextAlignmentOptions.Center;
        legenda.rectTransform.sizeDelta = new Vector2(2.6f, 0.8f);

        Ir(0);
    }

    void Ir(int i) { trecho = i; tempo = Trechos[i].ini; cartela = -1f; }

    void Update()
    {
        LerControles();
        float dt = Time.deltaTime * (lento ? velocidadeLenta : 1f);

        if (cartela >= 0f)
        {
            cartela += Time.deltaTime;
            if (cartela > duracaoCartela) Ir((trecho + 1) % Trechos.Length);
        }
        else
        {
            tempo += dt;
            if (tempo >= Trechos[trecho].fim)
            {
                tempo = Trechos[trecho].fim;
                cartela = 0f;  // pausa com cartela antes do próximo trecho
            }
        }

        playable.SetTime(tempo);
        graph.Evaluate(0f);
        AtualizarLegenda();
    }

    void AtualizarLegenda()
    {
        var tr = Trechos[trecho];
        string selo = tr.certo
            ? $"<color=#{ColorUtility.ToHtmlStringRGB(VERDE)}>✔ JEITO CERTO</color>"
            : $"<color=#{ColorUtility.ToHtmlStringRGB(VERMELHO)}>✖ JEITO ERRADO</color>";
        string texto = "";
        foreach (var l in Legendas) if (tempo >= l.t) texto = l.texto;

        if (cartela >= 0f)
        {
            bool vaiProCerto = !tr.certo;
            legenda.text = vaiProCerto
                ? $"<size=130%><color=#{ColorUtility.ToHtmlStringRGB(VERDE)}>Agora, o jeito certo</color></size>"
                : "<size=110%>5 regras de ouro</size>\n<size=60%>Avalie a carga · Coluna reta · Carga junto ao corpo\nSem trancos · Gire com os pés</size>";
        }
        else
        {
            legenda.text = $"<size=60%>{selo}{(lento ? "  ·  CÂMERA LENTA" : "")}</size>\n{texto}" +
                           "\n<size=40%><color=#9AA6B8>A reiniciar · B câmera lenta · X jeito certo</color></size>";
        }

        var cam = Camera.main;
        if (cam != null)
        {
            Vector3 dir = legenda.transform.position - cam.transform.position;
            dir.y = 0f;
            if (dir.sqrMagnitude > 0.001f) legenda.transform.rotation = Quaternion.LookRotation(dir);
        }
    }

    bool Botao(XRNode mao, InputFeatureUsage<bool> uso)
    {
        InputDevices.GetDevicesAtXRNode(mao, devices);
        return devices.Count > 0 && devices[0].TryGetFeatureValue(uso, out bool v) && v;
    }

    void LerControles()
    {
        bool a = Botao(XRNode.RightHand, CommonUsages.primaryButton);
        bool b = Botao(XRNode.RightHand, CommonUsages.secondaryButton);
        bool x = Botao(XRNode.LeftHand, CommonUsages.primaryButton);
        if (a && !aAntes) Ir(0);
        if (b && !bAntes) lento = !lento;
        if (x && !xAntes) Ir(1);
        aAntes = a; bAntes = b; xAntes = x;
    }

    void OnDestroy() { if (graph.IsValid()) graph.Destroy(); }
}
