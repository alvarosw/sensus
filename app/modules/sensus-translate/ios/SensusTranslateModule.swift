import ExpoModulesCore
import MLKitTranslate

/// Tradução no aparelho com Google ML Kit (iOS), só inglês -> português.
/// Mesma API JS do módulo Android (status, download, translate, removeModels). Nada é gravado pelo módulo.
public class SensusTranslateModule: Module {
  private lazy var translator: Translator = {
    let options = TranslatorOptions(sourceLanguage: .english, targetLanguage: .portuguese)
    return Translator.translator(options: options)
  }()

  public func definition() -> ModuleDefinition {
    Name("SensusTranslate")

    /// true quando os dois modelos (en e pt) estão baixados.
    AsyncFunction("status") { (promise: Promise) in
      let models = ModelManager.modelManager().downloadedTranslateModels
      let hasEnglish = models.contains { $0.language == .english }
      let hasPortuguese = models.contains { $0.language == .portuguese }
      promise.resolve(hasEnglish && hasPortuguese)
    }

    /// Baixa os modelos se faltarem (sem exigir Wi-Fi, como no Android).
    AsyncFunction("download") { (promise: Promise) in
      SensusTranslateModule.ensureModel(self.translator, promise: promise)
    }

    /// Traduz uma lista de trechos, na ordem recebida.
    AsyncFunction("translate") { (texts: [String], promise: Promise) in
      if texts.isEmpty {
        promise.resolve([String]())
        return
      }
      let translator = self.translator
      SensusTranslateModule.ensureModel(translator, promise: promise) {
        SensusTranslateModule.translateFrom(texts, index: 0, out: [], translator: translator, promise: promise)
      }
    }

    /// Apaga os dois modelos do aparelho. Par ausente é ignorado.
    AsyncFunction("removeModels") { (promise: Promise) in
      let manager = ModelManager.modelManager()
      let english = TranslateRemoteModel.translateRemoteModel(language: .english)
      let portuguese = TranslateRemoteModel.translateRemoteModel(language: .portuguese)
      manager.deleteDownloadedModel(english) { _ in
        manager.deleteDownloadedModel(portuguese) { _ in
          promise.resolve()
        }
      }
    }
  }

  /// Garante os modelos e depois chama `then` (ou resolve a promessa com a lista vazia de erro).
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
