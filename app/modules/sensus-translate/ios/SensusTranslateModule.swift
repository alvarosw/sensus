import ExpoModulesCore
import Foundation
import MLKitTranslate

/// Tradução no aparelho com Google ML Kit (iOS), para qualquer par dos idiomas do app. Mesma API JS do módulo Android
/// (status, download, translate, removeModels). Os códigos chegam do JS no formato do ML Kit (campo mlkit de APP_LANGS).
/// Nada é gravado pelo módulo.
public class SensusTranslateModule: Module {
  /// Tradutores por par ("en>pt"), criados na primeira vez. O acesso é protegido por lock: as chamadas podem vir de
  /// threads diferentes.
  private var translators: [String: Translator] = [:]
  private let lock = NSLock()

  /// Idioma do ML Kit (TranslateLanguage) de um código do app; nil se o código não é um dos 14 idiomas com modelo.
  static func language(_ tag: String) -> TranslateLanguage? {
    switch tag {
    case "ar": return .arabic
    case "bn": return .bengali
    case "de": return .german
    case "en": return .english
    case "es": return .spanish
    case "fr": return .french
    case "hi": return .hindi
    case "id": return .indonesian
    case "ja": return .japanese
    case "pt": return .portuguese
    case "ru": return .russian
    case "ur": return .urdu
    case "vi": return .vietnamese
    case "zh": return .chinese
    default: return nil
    }
  }

  private func translator(_ from: String, _ to: String) -> Translator? {
    guard let source = SensusTranslateModule.language(from), let target = SensusTranslateModule.language(to) else {
      return nil
    }
    lock.lock()
    defer { lock.unlock() }
    let key = "\(from)>\(to)"
    if let existing = translators[key] { return existing }
    let created = Translator.translator(options: TranslatorOptions(sourceLanguage: source, targetLanguage: target))
    translators[key] = created
    return created
  }

  public func definition() -> ModuleDefinition {
    Name("SensusTranslate")

    /// true quando os dois modelos do par (origem e destino) estão baixados.
    AsyncFunction("status") { (from: String, to: String, promise: Promise) in
      guard let source = SensusTranslateModule.language(from), let target = SensusTranslateModule.language(to) else {
        promise.resolve(false)
        return
      }
      let models = ModelManager.modelManager().downloadedTranslateModels
      let hasSource = models.contains { $0.language == source }
      let hasTarget = models.contains { $0.language == target }
      promise.resolve(hasSource && hasTarget)
    }

    /// Baixa os modelos do par se faltarem (sem exigir Wi-Fi, como no Android).
    AsyncFunction("download") { (from: String, to: String, promise: Promise) in
      guard let translator = self.translator(from, to) else {
        promise.reject("ML_KIT_LANGUAGE", "Par sem modelo: \(from) -> \(to).")
        return
      }
      SensusTranslateModule.ensureModel(translator, promise: promise)
    }

    /// Traduz uma lista de trechos do par, na ordem recebida.
    AsyncFunction("translate") { (texts: [String], from: String, to: String, promise: Promise) in
      if texts.isEmpty {
        promise.resolve([String]())
        return
      }
      guard let translator = self.translator(from, to) else {
        promise.reject("ML_KIT_LANGUAGE", "Par sem modelo: \(from) -> \(to).")
        return
      }
      SensusTranslateModule.ensureModel(translator, promise: promise) {
        SensusTranslateModule.translateFrom(texts, index: 0, out: [], translator: translator, promise: promise)
      }
    }

    /// Apaga os modelos baixados, exceto o inglês (compartilhado por todos os pares). Modelo ausente é ignorado.
    AsyncFunction("removeModels") { (promise: Promise) in
      let manager = ModelManager.modelManager()
      let others = manager.downloadedTranslateModels.filter { $0.language != .english }
      let group = DispatchGroup()
      for model in others {
        group.enter()
        manager.deleteDownloadedModel(model) { _ in group.leave() }
      }
      group.notify(queue: .main) {
        promise.resolve()
      }
    }
  }

  /// Garante os modelos e depois chama `then` (sem `then`, resolve a promessa).
  private static func ensureModel(_ translator: Translator, promise: Promise, then: (() -> Void)? = nil) {
    let conditions = ModelDownloadConditions(allowsCellularAccess: true, allowsBackgroundDownloading: true)
    translator.downloadModelIfNeeded(with: conditions) { error in
      if let error = error {
        promise.reject("ML_KIT_DOWNLOAD", error.localizedDescription)
        return
      }
      if let then = then {
        then()
      } else {
        promise.resolve()
      }
    }
  }

  private static func translateFrom(
    _ texts: [String],
    index: Int,
    out: [String],
    translator: Translator,
    promise: Promise
  ) {
    if index >= texts.count {
      promise.resolve(out)
      return
    }
    translator.translate(texts[index]) { result, error in
      if let error = error {
        promise.reject("ML_KIT_TRANSLATE", error.localizedDescription)
        return
      }
      guard let result = result else {
        promise.reject("ML_KIT_TRANSLATE", "Sem resultado para o trecho \(index).")
        return
      }
      translateFrom(texts, index: index + 1, out: out + [result], translator: translator, promise: promise)
    }
  }
}
